import { bounded } from "@/utils/local";
import { unregisterPush } from "@/services/push-device";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthSession, SessionUser } from "@/types/models";
import {
  api,
  ApiError,
  getSession,
  setSession,
  subscribeSession,
  setApiTimezone,
} from "@/services/api";
import { clearSession, readSession, writeSession } from "@/utils/storage";
type AuthContextValue = {
  user: SessionUser | null;
  initializing: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: SessionUser) => Promise<void>;
};
const Context = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => subscribeSession((value) => setUser(value?.user ?? null)),
    [],
  );
  useEffect(() => {
    let active = true;
    void bounded(readSession(), null).then((stored) => {
      if (!active) return;
      if (stored) {
        setSession(stored);
        setApiTimezone(
          stored.user.timezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
      }
      // Navigation must never wait for the network, even for a saved session.
      setInitializing(false);
      if (!stored) return;
      const expectedUser = stored.user.id;
      void api
        .me()
        .then(async (profile) => {
          const current = getSession();
          if (active && current?.user.id === expectedUser) {
            const next = { ...current, user: profile };
            setSession(next);
            await writeSession(next);
          }
        })
        .catch(() => {
          // The API refresh layer clears only a proven invalid refresh token.
          // Network failures and timeouts retain the stored session.
        });
    });
    return () => {
      active = false;
    };
  }, []);
  const establish = async (next: AuthSession) => {
    setSession(next);
    await bounded(writeSession(next), undefined);
    if (!next.user.timezone) {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setApiTimezone(zone);
      void api
        .profile({ timezone: zone })
        .then(async (profile) => {
          const current = getSession();
          if (current?.user.id === next.user.id) {
            const updated = { ...current, user: profile };
            setSession(updated);
            await writeSession(updated);
          }
        })
        .catch(() => {});
    }
  };
  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await establish(await api.login({ email, password }));
      return true;
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to connect to the server. Please try again.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        await api.signup({ name, email, password });
        await establish(await api.login({ email, password }));
        return true;
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Unable to create account",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await unregisterPush().catch(() => {});
      await api.logout();
    } catch {
      /* Clear the local session even when offline. */
    } finally {
      setSession(null);
      await clearSession();
      setLoading(false);
    }
  }, []);
  const updateUser = useCallback(async (profile: SessionUser) => {
    const current = getSession();
    if (current) {
      const next = { ...current, user: profile };
      setSession(next);
      await writeSession(next);
    }
  }, []);
  const value = useMemo(
    () => ({
      user,
      initializing,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      updateUser,
      clearError: () => setError(null),
    }),
    [user, initializing, loading, error, signIn, signUp, signOut, updateUser],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}
