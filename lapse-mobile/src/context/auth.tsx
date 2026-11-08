import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { AuthSession, SessionUser } from "@/types/models";
import { api, setSession } from "@/services/api";
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
};

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(reason: unknown): string {
    return reason instanceof Error ? reason.message : "Something went wrong";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        readSession()
            .then((stored) => {
                if (!active || !stored) {
                    return;
                }
                setSession(stored);
                setUser(stored.user);
            })
            .finally(() => {
                if (active) {
                    setInitializing(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        setLoading(true);
        setError(null);
        try {
            const next = await api.login({ email, password });
            setSession(next);
            await writeSession(next);
            setUser(next.user);
            return true;
        } catch (reason: unknown) {
            setError(errorMessage(reason));
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
                const next = await api.login({ email, password });
                setSession(next);
                await writeSession(next);
                setUser(next.user);
                return true;
            } catch (reason: unknown) {
                setError(errorMessage(reason));
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
            await api.logout();
        } finally {
            setSession(null);
            await clearSession();
            setUser(null);
            setLoading(false);
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
            clearError: () => setError(null),
        }),
        [error, initializing, loading, signIn, signOut, signUp, user],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }
    return context;
}
