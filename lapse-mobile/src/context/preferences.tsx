import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { colors, lightColors, type Palette } from "@/constants/theme";
import { useAuth } from "@/context/auth";

type Mode = "System" | "Light" | "Dark";
type Preferences = { mode: Mode; notifications: boolean[] };
const defaults: Preferences = {
    mode: "Dark",
    notifications: [true, true, true, false],
};
const Context = createContext({
    ...defaults,
    colors: colors as Palette,
    dark: true,
    setMode: (_mode: Mode) => {},
    setNotification: (_index: number, _enabled: boolean) => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const storageKey = `lapse.preferences.${user?.id ?? "guest"}`;
    return (
        <UserPreferences key={storageKey} storageKey={storageKey}>
            {children}
        </UserPreferences>
    );
}
function UserPreferences({
    children,
    storageKey: key,
}: {
    children: ReactNode;
    storageKey: string;
}) {
    const systemScheme = useColorScheme();
    const [preferences, setPreferences] = useState(defaults);
    const [loadedKey, setLoadedKey] = useState("");
    useEffect(() => {
        let active = true;
        const read =
            Platform.OS === "web"
                ? Promise.resolve(globalThis.localStorage?.getItem(key))
                : SecureStore.getItemAsync(key);
        read.then((raw) => {
            if (!active) return;
            if (raw) {
                try {
                    const value = JSON.parse(raw) as Preferences;
                    if (
                        ["System", "Light", "Dark"].includes(value.mode) &&
                        value.notifications?.length === 4 &&
                        value.notifications.every((v) => typeof v === "boolean")
                    )
                        setPreferences(value);
                } catch {
                    /* Invalid preferences fall back to the reference's dark default. */
                }
            }
        })
            .catch(() => {})
            .finally(() => {
                if (active) setLoadedKey(key);
            });
        return () => {
            active = false;
        };
    }, [key]);
    useEffect(() => {
        if (loadedKey !== key) return;
        const serialized = JSON.stringify(preferences);
        if (Platform.OS === "web") {
            try {
                globalThis.localStorage?.setItem(key, serialized);
            } catch {
                /* Keep the in-memory preference if storage is unavailable. */
            }
        } else void SecureStore.setItemAsync(key, serialized).catch(() => {});
    }, [key, loadedKey, preferences]);
    const dark =
        preferences.mode === "Dark" ||
        (preferences.mode === "System" && systemScheme !== "light");
    return (
        <Context.Provider
            value={{
                ...preferences,
                dark,
                colors: dark ? colors : lightColors,
                setMode: (mode) =>
                    setPreferences((current) => ({ ...current, mode })),
                setNotification: (index, enabled) =>
                    setPreferences((current) => ({
                        ...current,
                        notifications: current.notifications.map((v, i) =>
                            i === index ? enabled : v,
                        ),
                    })),
            }}
        >
            {children}
        </Context.Provider>
    );
}
export const usePreferences = () => useContext(Context);
export const useThemeColors = () => usePreferences().colors;
