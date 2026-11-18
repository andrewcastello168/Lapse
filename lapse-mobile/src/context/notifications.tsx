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
import { api, ApiError, getSession, subscribeItems } from "@/services/api";
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
    setSyncing(true);
    setError("");
    const current = () =>
      version === generation.current && getSession()?.user.id === user?.id;
    try {
      const allowed = await permission();
      if (!current()) return;
      setStatus(allowed);
      // Explicit disable and OS denial work even when remote requests fail.
      if (!user || !prefs.remindersEnabled || allowed === "denied")
        await reconcileReminders([]);
      if (user) {
        serverActive.current =
          (await readLocal(`lapse.push.${user.id}`)) === "active";
        try {
          const remote = await api.notificationPreferences();
          if (!current()) return;
          // Preferences/inbox do not depend on the scheduled-dispatch release gate.
          if (!remoteHydrated.current) {
            remoteHydrated.current = true;
            if (remote.initialized && prefs.notificationRevision === 0) {
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
          if (!current()) return;
          const remoteInbox = await api.notificationInbox();
          if (!current()) return;
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
          await writeInbox(user.id, entries);
          const registered =
            allowed === "granted" && prefs.remindersEnabled
              ? await registerPush(true, {
                  enabled: prefs.remindersEnabled,
                  offsets: prefs.reminderOffsets,
                  hour: prefs.reminderHour,
                  timezone: prefs.timezone,
                })
              : false;
          if (!current()) return;
          if (allowed === "denied" || !prefs.remindersEnabled)
            await registerPush(false);
          if (!current()) return;
          if (
            reminderTransport(
              remote.configured,
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
          if (!remote.configured) {
            serverActive.current = false;
            await writeLocal(`lapse.push.${user.id}`, "inactive");
          }
        } catch (reason) {
          if (!current()) return;
          setError(
            reason instanceof ApiError && reason.status === 401
              ? "Unable to confirm your notification session. Retry when connected. If this continues, sign in again."
              : "Unable to sync notification settings. Your choices are kept on this device. Please retry.",
          );
          // An outage never reactivates a duplicate local queue after switching.
          if (reminderTransport(null, false, serverActive.current) === "server")
            return;
        }
      }
      if (
        !current() ||
        !user ||
        !prefs.remindersEnabled ||
        allowed !== "granted"
      )
        return;
      const plans = await Promise.all(
        prefs.reminderOffsets.map((offset) =>
          api.reminders(offset, prefs.reminderHour, prefs.timezone),
        ),
      );
      const reminders = plans
        .flatMap((plan) => plan.data)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .slice(0, 60);
      if (!current()) return;
      if (Platform.OS !== "web") {
        const presented = await Notifications.getPresentedNotificationsAsync();
        for (const notification of presented) {
          if (!current()) return;
          const entry = inboxEntry(notification);
          if (entry) await merge(entry);
        }
      }
      if (!current()) return;
      await reconcileReminders(
        reminders,
        inboxRef.current.map((row) => row.id),
      );
    } catch {
      if (current())
        setError(
          "Unable to update reminders. Check your connection and notification settings.",
        );
    } finally {
      if (version === generation.current) setSyncing(false);
    }
  }, [
    initializing,
    prefs.ready,
    prefs.notificationRevision,
    updatePreferences,
    prefs.remindersEnabled,
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
