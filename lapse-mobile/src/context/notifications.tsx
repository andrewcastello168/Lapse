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
  const [status, setStatus] = useState<Permission>("undetermined");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const generation = useRef(0);
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
    } catch (reason) {
      if (version === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to update reminders",
        );
    } finally {
      if (version === generation.current) setSyncing(false);
    }
  }, [
    initializing,
    prefs.ready,
    prefs.remindersEnabled,
    prefs.reminderOffset,
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
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void sync();
    }, 6 * 3600000);
    return () => {
      unsubscribe();
      app.remove();
      clearInterval(timer);
      clearTimeout(startup);
      invalidate();
    };
  }, [sync]);
  useEffect(() => {
    if (Platform.OS === "web") return;
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
      },
    );
    const open = (response: Notifications.NotificationResponse) => {
      const entry = inboxEntry(response.notification);
      if (entry && user && entry.id.startsWith(user.id + ":")) {
        void merge(entry);
        router.push({ pathname: "/item/[id]", params: { id: entry.itemId } });
      }
    };
    const response =
      Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last) {
        open(last);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, [merge, user]);
  const requestPermission = async () => {
    try {
      setStatus(await permission(true));
      await sync();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to request notification permission",
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
      await writeInbox(user.id, entries);
    } catch {
      setError("Unable to save the reminder inbox on this device");
    }
  };
  return (
    <Context.Provider
      value={{
        permission: status,
        error,
        syncing,
        inbox,
        sync,
        requestPermission,
        markRead,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useLocalNotifications = () => useContext(Context);
