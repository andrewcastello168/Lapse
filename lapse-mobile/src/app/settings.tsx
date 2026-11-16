import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, Switch, Text, View } from "react-native";
import { Check, ChevronRight, UserRound } from "lucide-react-native";
import Constants from "expo-constants";
import { Button, Input, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { usePreferences, type Mode } from "@/context/preferences";
import { useLocalNotifications } from "@/context/notifications";
import { api, setApiTimezone } from "@/services/api";
const titles: Record<string, string> = {
  profile: "Profile",
  edit: "Edit profile",
  password: "Change password",
  notifications: "Notifications",
  reminder: "Default reminder",
  appearance: "Appearance",
  timezone: "Timezone",
  about: "About Lapse",
};
export default function Settings() {
  const { section = "profile" } = useLocalSearchParams<{ section?: string }>();
  const prefs = usePreferences();
  const c = prefs.colors;
  const { user, updateUser, signOut } = useAuth();
  const notifications = useLocalNotifications();
  const [name, setName] = useState(user?.name ?? "");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [zone, setZone] = useState(prefs.timezone);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/(tabs)/preferences");
  async function save() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (section === "edit") {
        if (!name.trim()) throw new Error("Enter your name");
        await updateUser(await api.profile({ name: name.trim() }));
        setMessage("Your profile has been updated");
      } else if (section === "timezone") {
        try {
          new Intl.DateTimeFormat("en", { timeZone: zone }).format();
        } catch {
          throw new Error("Choose a valid IANA timezone");
        }
        const profile = await api.profile({ timezone: zone });
        setApiTimezone(zone);
        prefs.update({ timezone: zone });
        await updateUser(profile);
        setMessage("Timezone updated");
      } else {
        if (password.length < 8) throw new Error("Use at least 8 characters");
        await api.changePassword(current, password);
        await signOut();
        router.replace("/auth?mode=signin");
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save settings",
      );
    } finally {
      setBusy(false);
    }
  }
  const supported = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf?.("timeZone") ?? [
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    "UTC",
  ];
  const row = (
    label: string,
    value: string,
    onPress: () => void,
    selected = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 57,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        borderBottomWidth: 0.5,
        borderColor: c.border,
        paddingVertical: 12,
      }}
    >
      <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{label}</Text>
      {value ? (
        <Text style={{ color: c.muted, fontSize: 12 }}>{value}</Text>
      ) : null}
      {selected ? (
        <Check size={19} color={c.accentDark} />
      ) : (
        <ChevronRight size={16} color={c.muted} />
      )}
    </Pressable>
  );
  return (
    <Screen title={titles[section] ?? "Settings"} onBack={back}>
      {section === "profile" ? (
        <>
          <View style={{ alignItems: "center", paddingVertical: 30 }}>
            <View
              style={{
                padding: 22,
                borderRadius: 50,
                backgroundColor: c.accentTint,
              }}
            >
              <UserRound size={44} color={c.accentDark} />
            </View>
            <Text
              style={{
                fontSize: 26,
                fontWeight: "700",
                color: c.text,
                marginTop: 18,
              }}
            >
              {user?.name}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, marginTop: 7 }}>
              {user?.email}
            </Text>
          </View>
          {row("Edit profile", "", () => router.push("/settings?section=edit"))}
          {row("Change password", "", () =>
            router.push("/settings?section=password"),
          )}
          {row("Timezone", prefs.timezone, () =>
            router.push("/settings?section=timezone"),
          )}
        </>
      ) : null}
      {section === "edit" ? (
        <View style={{ marginTop: 24 }}>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
          <Input label="Email" value={user?.email ?? ""} editable={false} />
          <Button
            title={busy ? "Saving…" : "Save profile"}
            disabled={busy}
            onPress={() => void save()}
          />
        </View>
      ) : null}
      {section === "password" ? (
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: c.muted, lineHeight: 22, marginBottom: 24 }}>
            Changing your password signs out your devices. You can sign in again
            with your new password.
          </Text>
          <Input
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoComplete="current-password"
            maxLength={128}
          />
          <Input
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            maxLength={128}
          />
          <Button
            title={busy ? "Updating…" : "Change password"}
            disabled={busy || !current || password.length < 8}
            onPress={() => void save()}
          />
        </View>
      ) : null}
      {section === "notifications" ? (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              marginTop: 24,
              paddingVertical: 14,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: c.text }}>
                Expiration reminders
              </Text>
              <Text
                style={{
                  color: c.muted,
                  fontSize: 13,
                  lineHeight: 20,
                  marginTop: 7,
                }}
              >
                A gentle reminder before your important dates.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Expiration reminders"
              value={prefs.remindersEnabled}
              trackColor={{ true: c.accent, false: c.border }}
              onValueChange={(value) => {
                prefs.update({ remindersEnabled: value });
                if (value) void notifications.requestPermission();
              }}
            />
          </View>
          <Text
            style={{
              color: c.muted,
              fontSize: 13,
              lineHeight: 22,
              marginVertical: 20,
            }}
          >
            {notifications.permission === "unsupported"
              ? "Local reminders are available in the iOS and Android app."
              : notifications.permission === "granted"
                ? "Notifications are allowed on this device."
                : notifications.permission === "denied"
                  ? "Notifications are blocked in device settings."
                  : "Allow notifications to receive reminders on this device."}
          </Text>
          {notifications.permission === "undetermined" ? (
            <Button
              title="Allow notifications"
              onPress={() => void notifications.requestPermission()}
            />
          ) : notifications.permission === "denied" ? (
            <Button
              title="Open device settings"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          {row("Default reminder", prefs.reminderOffset + " days before", () =>
            router.push("/settings?section=reminder"),
          )}
          {row("Notification inbox", "", () => router.push("/notifications"))}
          <Text
            style={{
              color: c.muted,
              fontSize: 12,
              lineHeight: 20,
              marginTop: 24,
            }}
          >
            Reminders are scheduled on each device separately. Open Lapse
            periodically to refresh upcoming reminders. Your device controls
            final delivery.
          </Text>
          {notifications.syncing ? (
            <Text style={{ color: c.accentDark, marginTop: 16 }}>
              Updating reminders…
            </Text>
          ) : null}
          {notifications.error ? (
            <>
              <Text style={{ color: c.danger, marginVertical: 16 }}>
                {notifications.error}
              </Text>
              <Button
                title="Retry reminder sync"
                onPress={() => void notifications.sync()}
              />
            </>
          ) : null}
        </>
      ) : null}
      {section === "reminder" ? (
        <>
          <Text
            style={{
              color: c.muted,
              lineHeight: 22,
              marginTop: 20,
              marginBottom: 12,
            }}
          >
            Remind me before each due date
          </Text>
          {([1, 3, 7, 30] as const).map((offset) =>
            row(
              offset + " " + (offset === 1 ? "day" : "days") + " before",
              "",
              () => prefs.update({ reminderOffset: offset }),
              prefs.reminderOffset === offset,
            ),
          )}
          <Text
            style={{
              color: c.text,
              fontWeight: "600",
              fontSize: 14,
              marginTop: 26,
              marginBottom: 10,
            }}
          >
            Delivery time · {prefs.timezone}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[7, 8, 9, 10, 12, 18, 20].map((hour) => (
              <Pressable
                key={hour}
                accessibilityRole="radio"
                accessibilityState={{ checked: prefs.reminderHour === hour }}
                onPress={() => prefs.update({ reminderHour: hour })}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor:
                    prefs.reminderHour === hour ? c.accentTint : c.surface2,
                }}
              >
                <Text
                  style={{
                    color: prefs.reminderHour === hour ? c.accentDark : c.muted,
                    fontSize: 13,
                  }}
                >
                  {String(hour).padStart(2, "0")}:00
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      {section === "appearance" ? (
        <View style={{ marginTop: 20 }}>
          {(["System", "Light", "Dark"] as Mode[]).map((mode) =>
            row(
              mode,
              mode === "System" ? "Follow device appearance" : "",
              () => prefs.update({ mode }),
              prefs.mode === mode,
            ),
          )}
        </View>
      ) : null}
      {section === "timezone" ? (
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: c.muted, lineHeight: 22, marginBottom: 18 }}>
            Dates and reminders follow your selected timezone.
          </Text>
          <Input
            label="Selected timezone"
            value={zone}
            onChangeText={setZone}
            autoCapitalize="none"
          />
          <Button
            title={busy ? "Saving…" : "Save timezone"}
            disabled={busy}
            onPress={() => void save()}
          />
          {row("Use device timezone", "", () =>
            setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
          )}
          <Input
            label="Find a timezone"
            value={search}
            onChangeText={setSearch}
            placeholder="Search city or region"
            autoCapitalize="none"
          />
          {supported
            .filter((value) =>
              value.toLowerCase().includes(search.trim().toLowerCase()),
            )
            .slice(0, 40)
            .map((value) =>
              row(value, "", () => setZone(value), zone === value),
            )}
        </View>
      ) : null}
      {section === "about" ? (
        <View style={{ paddingVertical: 30 }}>
          <Text
            style={{
              color: c.text,
              fontSize: 36,
              fontWeight: "800",
              letterSpacing: -1,
            }}
          >
            lapse.
          </Text>
          <Text
            style={{
              color: c.muted,
              lineHeight: 24,
              fontSize: 15,
              marginTop: 18,
            }}
          >
            Your personal expiration and renewal manager.
          </Text>
          <Text
            style={{
              color: c.muted,
              lineHeight: 22,
              fontSize: 13,
              marginTop: 20,
            }}
          >
            Track subscriptions, documents, memberships, and the dates that
            matter. Lapse tracks schedules and confirmed validity; it does not
            process payments or verify external renewals.
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 30 }}>
            Version {Constants.expoConfig?.version ?? "1.0.0"} · {Platform.OS}
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.danger, lineHeight: 22, marginVertical: 18 }}
        >
          {error}
        </Text>
      ) : null}
      {message ? (
        <Text
          style={{ color: c.accentDark, lineHeight: 22, marginVertical: 18 }}
        >
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}
