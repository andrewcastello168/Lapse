import { bounded } from "@/utils/local";
import { reminderOffsetsOf, resolveTimezone } from "@/utils/preferences";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { colors, lightColors, type Palette } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api, setApiTimezone } from "@/services/api";
export type Mode = "System" | "Light" | "Dark";
export type Preferences = {
  mode: Mode;
  remindersEnabled: boolean;
  reminderOffset: 1 | 3 | 7 | 30;
  reminderHour: number;
  timezone: string;
  timezoneMode: "automatic" | "manual";
  reminderOffsets: number[];
};
const defaults: Preferences = {
  mode: "Light",
  timezoneMode: "automatic",
  reminderOffsets: [7, 1, 0],
  remindersEnabled: true,
  reminderOffset: 7,
  reminderHour: 9,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
};
const Context = createContext({
  ...defaults,
  ready: false,
  colors: lightColors as Palette,
  dark: false,
  update: (_value: Partial<Preferences>) => {},
});
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = `lapse.preferences.${user?.id ?? "guest"}`;
  return (
    <UserPreferences key={key} storageKey={key}>
      {children}
    </UserPreferences>
  );
}
function UserPreferences({
  children,
  storageKey,
}: {
  children: ReactNode;
  storageKey: string;
}) {
  const { user } = useAuth();
  const [initialZone] = useState(user?.timezone ?? defaults.timezone);
  const scheme = useColorScheme();
  const [value, setValue] = useState<Preferences>({
    ...defaults,
    timezone: user?.timezone ?? defaults.timezone,
  });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const read =
      Platform.OS === "web"
        ? Promise.resolve(globalThis.localStorage?.getItem(storageKey))
        : SecureStore.getItemAsync(storageKey);
    bounded(read, null)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const saved = JSON.parse(raw) as Partial<Preferences> & {
            notifications?: boolean[];
          };
          const resolved = resolveTimezone(
            saved,
            Intl.DateTimeFormat().resolvedOptions().timeZone || initialZone,
            defaults.timezone,
          );
          setValue({
            ...defaults,
            mode: ["System", "Light", "Dark"].includes(saved.mode ?? "")
              ? saved.mode!
              : defaults.mode,
            timezone: resolved.timezone,
            timezoneMode: resolved.mode as "automatic" | "manual",
            reminderOffsets: reminderOffsetsOf(saved),
            remindersEnabled:
              typeof saved.remindersEnabled === "boolean"
                ? saved.remindersEnabled
                : (saved.notifications?.[0] ?? true),
            reminderOffset: [1, 3, 7, 30].includes(saved.reminderOffset ?? 0)
              ? saved.reminderOffset!
              : 7,
            reminderHour:
              Number.isInteger(saved.reminderHour) &&
              saved.reminderHour! >= 0 &&
              saved.reminderHour! <= 23
                ? saved.reminderHour!
                : 9,
          });
        } catch {
          /* Invalid stored settings use validated defaults. */
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [storageKey, initialZone]);
  useEffect(() => {
    if (!ready) return;
    setApiTimezone(value.timezone);
    const serialized = JSON.stringify(value);
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.setItem(storageKey, serialized);
      } catch {
        /* Preference remains active in memory. */
      }
    } else
      void SecureStore.setItemAsync(storageKey, serialized).catch(() => {});
  }, [ready, storageKey, value]);
  useEffect(() => {
    const refresh = () => {
      if (!ready || value.timezoneMode !== "automatic") return;
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || value.timezone;
      setValue((current) =>
        current.timezone === timezone ? current : { ...current, timezone },
      );
    };
    refresh();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => listener.remove();
  }, [ready, value.timezoneMode, value.timezone]);
  useEffect(() => {
    if (ready && user && user.timezone !== value.timezone)
      void api.profile({ timezone: value.timezone }).catch(() => {});
  }, [ready, user, value.timezone]);
  const update = useCallback(
    (patch: Partial<Preferences>) =>
      setValue((current) => ({ ...current, ...patch })),
    [],
  );
  const dark =
    value.mode === "Dark" || (value.mode === "System" && scheme === "dark");
  return (
    <Context.Provider
      value={{
        ...value,
        ready,
        dark,
        colors: dark ? colors : lightColors,
        update,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
export const useThemeColors = () => usePreferences().colors;
