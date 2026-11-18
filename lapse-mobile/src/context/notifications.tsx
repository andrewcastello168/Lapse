import Constants from "expo-constants";
import { reminderTransport } from "@/services/reminder-transport";
import { readLocal, writeLocal } from "@/utils/local";
import { registerPush, sendTestPush } from "@/services/push-device";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/auth";
import { usePreferences } from "@/context/preferences";
import { api, getSession, subscribeItems } from "@/services/api";
import {
  inboxEntry,
  cancelItemReminders,
  Notifications,
  permission,
  readInbox,
  reconcileReminders,
  writeInbox,
  type InboxEntry,
} from "@/services/notifications";
type Permission = "unsupported" | "granted" | "undetermined" | "denied";
const Context = createContext({
  permission: "undetermined" as Permission,
  error: "",
  syncing: false,
  inbox: [] as InboxEntry[],
  sync: async () => {},
  requestPermission: async () => {},
  markRead: async (_id: string) => {},
  markAllRead: async () => {},
  unread: 0,
  testing: false,
  testMessage: "",
  testPush: async () => {},
});
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return (
    <DeviceNotifications key={user?.id ?? "guest"}>
      {children}
    </DeviceNotifications>
  );
}
function DeviceNotifications({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const prefs = usePreferences();
  const updatePreferences = prefs.update;
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [status, setStatus] = useState<Permission>("undetermined");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const generation = useRef(0);
  const remoteHydrated = useRef(false);
  const serverActive = useRef(false);
  const inboxRef = useRef<InboxEntry[]>([]);
  const merge = useCallback(
    async (entry: InboxEntry) => {
      if (!user || !entry.id.startsWith(user.id + ":")) return;
      const existing = inboxRef.current.find((row) => row.id === entry.id);
      const entries = [
        existing ?? entry,
        ...inboxRef.current.filter((row) => row.id !== entry.id),
      ].sort((a, b) => b.date.localeCompare(a.date));
      inboxRef.current = entries;
      setInbox(entries);
      try {
        await writeInbox(user.id, entries);
      } catch {
        setError("Unable to save the reminder inbox on this device");
      }
    },
    [user],
  );
  const sync = useCallback(async () => {
    if (initializing || !prefs.ready) return;
    const version = ++generation.current;
    try {
      if (user) {
        serverActive.current =
          (await readLocal(`lapse.push.${user.id}`)) === "active";
        try {
          const remote = await api.notificationPreferences();
          const allowed = await permission();
          setStatus(allowed);
          const registered =
            allowed === "granted" && prefs.remindersEnabled
              ? await registerPush(true, {
                  enabled: prefs.remindersEnabled,
                  offsets: prefs.reminderOffsets,
                  hour: prefs.reminderHour,
                  timezone: prefs.timezone,
                })
              : false;
          if (allowed === "denied" || !prefs.remindersEnabled)
            await registerPush(false);
          if (remote.configured) {
            if (!remoteHydrated.current) {
              remoteHydrated.current = true;
              if (remote.initialized) {
                updatePreferences({
                  remindersEnabled: remote.enabled,
                  reminderOffsets: remote.offsets,
                  reminderHour: remote.hour,
                });
                return;
              }
            }
            await api.saveNotificationPreferences({
              enabled: prefs.remindersEnabled,
              offsets: prefs.reminderOffsets,
              hour: prefs.reminderHour,
              timezone: prefs.timezone,
            });
            if (
              version !== generation.current ||
              getSession()?.user.id !== user.id
            )
              return;
            const remoteInbox = await api.notificationInbox();
            const entries: InboxEntry[] = remoteInbox.data.map((row) => ({
              id: row.id,
              itemId: row.item_id ?? "",
              title: row.title,
              body: row.body,
              date: row.created_at,
              read: !!row.read_at,
            }));
            inboxRef.current = entries;
            setInbox(entries);
            setStatus(allowed);
            if (
              reminderTransport(
                true,
                registered &&
                  (await readLocal(`lapse.push.verified.${user.id}`)) ===
                    "received",
                serverActive.current,
              ) === "server"
            ) {
              serverActive.current = true;
              await writeLocal(`lapse.push.${user.id}`, "active");
              await reconcileReminders([]);
              return;
            }
          } else {
            serverActive.current = false;
            await writeLocal(`lapse.push.${user.id}`, "inactive");
          }
        } catch {
          if (
            reminderTransport(null, false, serverActive.current) === "server"
          ) {
            setError(
              "Server reminders are registered. Unable to refresh settings; please retry when connected",
            );
            return;
          }
          /* Preserve the functioning local path until push registers. */
        }
      }
      if (!user || !prefs.remindersEnabled) {
        await reconcileReminders([]);
        return;
      }
      const allowed = await permission();
      if (version !== generation.current) return;
      setSyncing(true);
      setError("");
      setStatus(allowed);
      if (!user || !prefs.remindersEnabled || allowed !== "granted") {
        await reconcileReminders([]);
        return;
      }
      const plan = await api.reminders(
        prefs.reminderOffset,
        prefs.reminderHour,
        prefs.timezone,
      );
      if (version !== generation.current || getSession()?.user.id !== user.id)
        return;
      if (Platform.OS !== "web") {
        const presented = await Notifications.getPresentedNotificationsAsync();
        for (const notification of presented) {
          const entry = inboxEntry(notification);
          if (entry) await merge(entry);
        }
      }
      if (version !== generation.current) return;
      await reconcileReminders(
        plan.data,
        inboxRef.current.map((row) => row.id),
      );
    } catch {
      if (version === generation.current)
        setError(
          "Unable to update reminders. Check your connection and native notification settings",
        );
    } finally {
      if (version === generation.current) setSyncing(false);
    }
  }, [
    initializing,
    prefs.ready,
    updatePreferences,
    prefs.remindersEnabled,
    prefs.reminderOffset,
    prefs.reminderOffsets,
    prefs.reminderHour,
    prefs.timezone,
    user,
    merge,
  ]);
  useEffect(() => {
    let active = true;
    if (user)
      readInbox(user.id).then((entries) => {
        if (active) {
          inboxRef.current = entries;
          setInbox(entries);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);
  useEffect(() => {
    const invalidate = () => {
      generation.current++;
    };
    const startup = setTimeout(() => void sync(), 0);
    const unsubscribe = subscribeItems((change) => {
      generation.current++;
      void (async () => {
        if (change.itemId) await cancelItemReminders(change.itemId);
        await sync();
      })().catch(() => setError("Unable to update reminders on this device"));
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    const tokens =
      Platform.OS !== "web" && Constants.executionEnvironment !== "storeClient"
        ? Notifications.addPushTokenListener(() => {
            void sync();
          })
        : null;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void sync();
    }, 6 * 3600000);
    return () => {
      tokens?.remove();
      unsubscribe();
      app.remove();
      clearInterval(timer);
      clearTimeout(startup);
      invalidate();
    };
  }, [sync]);
  useEffect(() => {
    if (
      initializing ||
      !user ||
      Platform.OS === "web" ||
      Constants.executionEnvironment === "storeClient"
    )
      return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    const received = Notifications.addNotificationReceivedListener(
      (notification) => {
        const entry = inboxEntry(notification);
        if (entry) void merge(entry);
        if (
          user &&
          notification.request.content.data?.test === true &&
          entry?.id.startsWith(user.id + ":")
        ) {
          setTestMessage(
            "Remote push received on this device. Scheduled dispatch remains disabled.",
          );
          void writeLocal(`lapse.push.verified.${user.id}`, "received").catch(
            () => {},
          );
        }
      },
    );
    const open = (response: Notifications.NotificationResponse) => {
      const entry = inboxEntry(response.notification);
      if (entry && user && entry.id.startsWith(user.id + ":")) {
        if (response.notification.request.content.data?.test === true) {
          setTestMessage("Remote push opened on this device.");
          void writeLocal(`lapse.push.verified.${user.id}`, "received").catch(
            () => {},
          );
        }
        if (!entry.itemId) {
          router.push("/notifications");
          return;
        }
        void merge(entry);
        router.push({ pathname: "/item/[id]", params: { id: entry.itemId } });
      }
    };
    const response =
      Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        if (last) {
          open(last);
          void Notifications.clearLastNotificationResponseAsync();
        }
      })
      .catch(() => {});
    return () => {
      received.remove();
      response.remove();
    };
  }, [merge, user, initializing]);
  const requestPermission = async () => {
    try {
      setStatus(await permission(true));
      await sync();
    } catch {
      setError(
        "Unable to enable notifications. Check device settings and use a matching native build",
      );
    }
  };
  const markRead = async (id: string) => {
    if (!user) return;
    const entries = inboxRef.current.map((row) =>
      row.id === id ? { ...row, read: true } : row,
    );
    inboxRef.current = entries;
    setInbox(entries);
    try {
      await api.readNotification(id).catch(() => {});
      await writeInbox(user.id, entries);
    } catch {
      setError("Unable to save the reminder inbox on this device");
    }
  };
  return (
    <Context.Provider
      value={{
        permission: status,
        testing,
        testMessage,
        testPush: async () => {
          if (testing) return;
          setTesting(true);
          setTestMessage(
            "Registering this device and submitting one remote test...",
          );
          try {
            const result = await sendTestPush();
            setTestMessage((current) =>
              current.startsWith("Remote push received")
                ? current
                : (result.message ?? "Test submitted; check your device."),
            );
          } catch (reason) {
            setTestMessage(
              reason instanceof Error
                ? reason.message
                : "Unable to test remote push. Please retry.",
            );
          } finally {
            setTesting(false);
          }
        },
        error,
        syncing,
        inbox,
        sync,
        requestPermission,
        markRead,
        unread: inbox.filter((row) => !row.read).length,
        markAllRead: async () => {
          if (!user) return;
          try {
            await api.readNotification();
            const entries = inboxRef.current.map((row) => ({
              ...row,
              read: true,
            }));
            inboxRef.current = entries;
            setInbox(entries);
            await writeInbox(user.id, entries);
          } catch {
            setError("Unable to mark reminders read. Please retry");
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useLocalNotifications = () => useContext(Context);
