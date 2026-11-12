import { usePreferences, useThemeColors } from "@/context/preferences";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Host, Switch } from "@expo/ui";
import * as Device from "expo-device";
import { AlertTriangle, Check, Circle, Smartphone } from "lucide-react-native";
import { Button, Card, Input, Screen } from "@/components/ui";
import type { Palette } from "@/constants/theme";

const notificationRows = [
    ["Push Notifications", "Receive reminders and important updates"],
    ["Expiry Reminders", "Get notified before your items expire"],
    ["New Login Alerts", "Get notified when a new device logs in"],
    ["Promotional Updates", "Product updates and tips"],
] as const;
export default function Settings() {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const { section = "notifications" } = useLocalSearchParams<{
        section?: string;
    }>();
    const {
        mode: appearance,
        setMode,
        notifications: enabled,
        setNotification,
        dark,
    } = usePreferences();
    const [confirmation, setConfirmation] = useState("");
    const title =
        section === "appearance"
            ? "Appearance"
            : section === "devices"
              ? "Logged in Devices"
              : section === "account"
                ? "Delete Account"
                : "Notifications";
    const back = () =>
        router.canGoBack() ? router.back() : router.replace("/(tabs)/profile");
    return (
        <Screen title={title} onBack={back}>
            {section === "notifications"
                ? notificationRows.map(([label, description], index) => (
                      <View key={label} style={s.row}>
                          <View style={s.main}>
                              <Text style={s.label}>{label}</Text>
                              <Text style={s.meta}>{description}</Text>
                          </View>
                          <Host
                              accessibilityLabel={label}
                              colorScheme={dark ? "dark" : "light"}
                              seedColor={colors.accent}
                              matchContents
                          >
                              <Switch
                                  value={enabled[index]}
                                  onValueChange={(value) =>
                                      setNotification(index, value)
                                  }
                              />
                          </Host>
                      </View>
                  ))
                : null}
            {section === "appearance"
                ? (["System", "Light", "Dark"] as const).map((mode) => (
                      <Pressable
                          key={mode}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: mode === appearance }}
                          style={[s.row, mode === appearance && s.selected]}
                          onPress={() => setMode(mode)}
                      >
                          <Circle
                              size={24}
                              color={
                                  mode === appearance
                                      ? colors.accent
                                      : colors.text
                              }
                              fill={
                                  mode === appearance
                                      ? colors.accentDark
                                      : "transparent"
                              }
                          />
                          <View style={s.main}>
                              <Text style={s.label}>{mode}</Text>
                              <Text style={s.meta}>
                                  {mode === "System"
                                      ? "Follow system settings"
                                      : `Always use ${mode.toLowerCase()} mode`}
                              </Text>
                          </View>
                          {mode !== "System" ? (
                              <View
                                  style={[
                                      s.preview,
                                      mode === "Light" && s.lightPreview,
                                  ]}
                              >
                                  <View style={s.previewLine} />
                                  <View style={s.previewLine} />
                                  <View style={s.previewLine} />
                              </View>
                          ) : null}
                      </Pressable>
                  ))
                : null}
            {section === "devices" ? (
                <>
                    <Text style={s.label}>Where you&apos;re signed in</Text>
                    <Text style={[s.meta, s.intro]}>
                        Don&apos;t recognize a device? Sign it out and change your
                        password.
                    </Text>
                    <Card style={s.row}>
                        <Smartphone size={24} color={colors.text} />
                        <View style={s.main}>
                            <Text style={s.label}>
                                {Device.modelName ??
                                    (Platform.OS === "web"
                                        ? "Web browser"
                                        : "This device")}
                            </Text>
                            <Text style={s.meta}>Active now</Text>
                        </View>
                        <Text style={s.tag}>This device</Text>
                    </Card>
                    <Button
                        title="Sign out from all other devices"
                        variant="danger"
                        onPress={() =>
                            Alert.alert(
                                "Logged in Devices",
                                "The server does not yet support listing or signing out other devices.",
                            )
                        }
                    />
                </>
            ) : null}
            {section === "account" ? (
                <>
                    <View style={s.dangerCard}>
                        <AlertTriangle size={24} color={colors.danger} />
                        <View style={s.main}>
                            <Text style={s.label}>Delete account</Text>
                            <Text style={s.dangerText}>
                                This action cannot be undone. Your data and
                                documents will be permanently deleted.
                            </Text>
                        </View>
                    </View>
                    {[
                        "Your items and documents",
                        "Your settings and preferences",
                        "Your notifications",
                        "Your account and profile data",
                    ].map((label) => (
                        <View key={label} style={s.checkRow}>
                            <Check size={15} color={colors.muted} />
                            <Text style={s.meta}>{label}</Text>
                        </View>
                    ))}
                    <Input
                        label={"Type “DELETE” to confirm"}
                        value={confirmation}
                        onChangeText={setConfirmation}
                        autoCapitalize="characters"
                    />
                    <Button
                        title="Delete Account"
                        variant="danger"
                        disabled={confirmation !== "DELETE"}
                        onPress={() =>
                            Alert.alert(
                                "Delete Account",
                                "Account deletion is not available because the server does not expose a delete-account endpoint.",
                            )
                        }
                    />
                </>
            ) : null}
        </Screen>
    );
}
const createStyles = (colors: Palette) =>
    StyleSheet.create({
        main: { flex: 1 },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: colors.surface,
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            minHeight: 64,
            marginBottom: 8,
        },
        label: { color: colors.text, fontSize: 14, fontWeight: "600" },
        meta: {
            color: colors.muted,
            fontSize: 12,
            marginTop: 4,
            lineHeight: 18,
        },
        intro: { marginBottom: 16 },
        selected: {
            borderColor: colors.accentDark,
            backgroundColor: colors.accentTint,
        },
        preview: {
            width: 48,
            height: 64,
            backgroundColor: colors.bg,
            borderWidth: 2,
            borderColor: colors.border,
            padding: 5,
            gap: 5,
            borderRadius: 5,
        },
        lightPreview: { backgroundColor: colors.text },
        previewLine: {
            height: 12,
            backgroundColor: colors.surface2,
            borderRadius: 2,
        },
        tag: {
            backgroundColor: colors.accent,
            color: colors.bg,
            fontSize: 10,
            fontWeight: "700",
            padding: 5,
            borderRadius: 5,
        },
        dangerCard: {
            flexDirection: "row",
            gap: 10,
            padding: 14,
            borderRadius: 8,
            backgroundColor: "#351A20",
            marginBottom: 16,
        },
        dangerText: {
            color: colors.danger,
            fontSize: 12,
            lineHeight: 18,
            marginTop: 6,
        },
        checkRow: {
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            marginBottom: 6,
        },
    });
