import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, Platform, Pressable, Switch, View } from "react-native";
import { Text } from "@/components/typography";
import { Check, ChevronRight, UserRound } from "lucide-react-native";
import Constants from "expo-constants";
import { Button, Input, Screen } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { usePreferences, type Mode } from "@/context/preferences";
import { useLocalNotifications } from "@/context/notifications";
import { api } from "@/services/api";
import { BottomSheet } from "@/components/bottom-sheet";
import { SelectionRow, offsetLabel } from "@/components/selection-row";
import {
  timezoneCatalogue,
  searchTimezones,
  timezoneOffset,
} from "@/utils/timezones";
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
  const [confirmation, setConfirmation] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showTime, setShowTime] = useState(false);
  const [zoneLimit, setZoneLimit] = useState(50);
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
      } else {
        if (password.length < 8) throw new Error("Use at least 8 characters");
        if (password !== confirmation) throw new Error("Passwords must match");
        await api.changePassword(current, password);
        await signOut();
        router.replace("/auth?mode=signin&passwordChanged=1");
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save settings",
      );
    } finally {
      setBusy(false);
    }
  }
  const supported = useMemo(
    () => timezoneCatalogue(prefs.timezone),
    [prefs.timezone],
  );
  const matches = useMemo(
    () => searchTimezones(supported, search),
    [supported, search],
  );
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
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            flexShrink: 1,
            maxWidth: "55%",
            textAlign: "right",
          }}
        >
          {value}
        </Text>
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
          <Input
            label="Confirm new password"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoComplete="new-password"
            maxLength={128}
          />
          {confirmation && password !== confirmation ? (
            <Text style={{ color: c.danger }}>Passwords must match</Text>
          ) : null}
          <Button
            title={busy ? "Updating…" : "Change password"}
            disabled={
              busy ||
              !current ||
              password.length < 8 ||
              password !== confirmation
            }
            onPress={() => void save()}
          />
        </View>
      ) : null}
      {section === "notifications" ? (
        <>
          {__DEV__ ? (
            <View
              style={{
                marginTop: 20,
                padding: 14,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 12 }}>
                Development tools
              </Text>
              <Button
                title={
                  notifications.testing
                    ? "Sending test push..."
                    : "Send test push notification"
                }
                disabled={notifications.testing}
                onPress={() => void notifications.testPush()}
              />
              <Text style={{ color: c.muted, lineHeight: 22, marginTop: 10 }}>
                Use an Android Development Build on your physical device. This
                sends one remote push through Supabase Edge and Expo; it does
                not enable scheduled reminders.
              </Text>
              {notifications.testMessage ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: c.text, lineHeight: 22, marginVertical: 12 }}
                >
                  {notifications.testMessage}
                </Text>
              ) : null}
            </View>
          ) : null}
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
              ? "Notifications are not available in this version on this device."
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
          {row(
            "Default reminder",
            prefs.reminderOffsets.map(offsetLabel).join(", "),
            () => router.push("/settings?section=reminder"),
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
            Choose when you’d like to be reminded. Your device’s notification
            and battery settings can affect when reminders appear.
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
          {([0, 1, 3, 7, 14, 30] as const).map((offset) => (
            <SelectionRow
              key={offset}
              label={offsetLabel(offset)}
              multiple
              selected={prefs.reminderOffsets.includes(offset)}
              onPress={() => {
                const offsets = prefs.reminderOffsets.includes(offset)
                  ? prefs.reminderOffsets.filter((n) => n !== offset)
                  : [...prefs.reminderOffsets, offset];
                if (offsets.length)
                  prefs.update({
                    reminderOffsets: offsets,
                    ...([1, 3, 7, 30].includes(offset)
                      ? { reminderOffset: offset as 1 | 3 | 7 | 30 }
                      : {}),
                  });
              }}
            />
          ))}
          <Text
            style={{
              color: c.text,
              fontWeight: "600",
              fontSize: 14,
              marginTop: 26,
              marginBottom: 10,
            }}
          >
            Delivery time
          </Text>
          {row(
            "Reminder time",
            `${String(prefs.reminderHour).padStart(2, "0")}:00`,
            () => setShowTime(true),
          )}
          {row(
            "Timezone",
            `${prefs.timezone.replaceAll("_", " ")} · ${timezoneOffset(prefs.timezone)}`,
            () => router.push("/settings?section=timezone"),
          )}
          <Text style={{ color: c.muted, lineHeight: 20, marginTop: 12 }}>
            Changes are saved on this device automatically.
          </Text>
          {notifications.syncing ? (
            <Text style={{ color: c.muted, marginTop: 12 }}>
              Syncing reminders…
            </Text>
          ) : null}
          {notifications.error ? (
            <>
              <Text
                accessibilityRole="alert"
                style={{ color: c.danger, marginTop: 12 }}
              >
                {notifications.error}
              </Text>
              <Button
                title="Retry reminder sync"
                variant="secondary"
                onPress={() => void notifications.sync()}
              />
            </>
          ) : null}
          <BottomSheet visible={showTime} onClose={() => setShowTime(false)}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
              Reminder time
            </Text>
            <Text style={{ color: c.muted, marginVertical: 10 }}>
              {prefs.timezone.replaceAll("_", " ")}
            </Text>
            {Array.from({ length: 24 }, (_, hour) => (
              <SelectionRow
                key={hour}
                label={`${String(hour).padStart(2, "0")}:00`}
                selected={prefs.reminderHour === hour}
                onPress={() => {
                  prefs.update({ reminderHour: hour });
                  setShowTime(false);
                }}
              />
            ))}
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setShowTime(false)}
            />
          </BottomSheet>
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
          {row(
            "Automatic timezone",
            prefs.timezoneMode === "automatic" ? "On" : "Off",
            () =>
              prefs.update({
                timezoneMode: "automatic",
                timezone:
                  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
              }),
            prefs.timezoneMode === "automatic",
          )}
          <Text style={{ color: c.muted, marginBottom: 12 }}>
            Selected: {prefs.timezone.replaceAll("_", " ")} (
            {timezoneOffset(prefs.timezone)}). Select a city below for a manual
            override.
          </Text>
          <Input
            label="Find a timezone"
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setZoneLimit(50);
            }}
            placeholder="Search city or region"
            autoCapitalize="none"
          />
          {matches.slice(0, zoneLimit).map((value) =>
            row(
              value.replaceAll("_", " "),
              timezoneOffset(value),
              () => {
                try {
                  new Intl.DateTimeFormat("en", { timeZone: value }).format();
                } catch {
                  setError(
                    "This timezone is unavailable on your device. Choose a nearby city with the same timezone.",
                  );
                  return;
                }
                setError("");
                prefs.update({ timezone: value, timezoneMode: "manual" });
              },
              prefs.timezoneMode === "manual" && prefs.timezone === value,
            ),
          )}
          {!matches.length ? (
            <Text style={{ color: c.muted }}>
              No matching timezones. Try a city or region.
            </Text>
          ) : null}
          {matches.length > zoneLimit ? (
            <Button
              title="Show more timezones"
              variant="secondary"
              onPress={() => setZoneLimit((n) => n + 50)}
            />
          ) : null}
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
