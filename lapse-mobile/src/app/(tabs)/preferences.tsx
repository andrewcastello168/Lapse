import { useState } from "react";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/components/typography";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Globe,
  Info,
  Palette,
  Shield,
  UserRound,
} from "lucide-react-native";
import { Screen } from "@/components/ui";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { useAuth } from "@/context/auth";
import { usePreferences } from "@/context/preferences";
export default function SettingsHome() {
  const { colors: c, mode, timezone, reminderOffset } = usePreferences();
  const { user, signOut, loading } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const rows = [
    { label: "Notifications", Icon: Bell, section: "notifications", value: "" },
    {
      label: "Default reminder",
      Icon: CalendarDays,
      section: "reminder",
      value: reminderOffset + " days before",
    },
    { label: "Appearance", Icon: Palette, section: "appearance", value: mode },
    { label: "Timezone", Icon: Globe, section: "timezone", value: timezone },
    { label: "Security", Icon: Shield, section: "password", value: "" },
    { label: "About Lapse", Icon: Info, section: "about", value: "" },
    { label: "Help & Support", Icon: Info, section: "help", value: "" },
  ];
  return (
    <Screen title="Settings">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/settings?section=profile")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          marginVertical: 20,
          padding: 18,
          borderRadius: 20,
          backgroundColor: c.accentTint,
        }}
      >
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: c.surface,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <UserRound color={c.accentDark} size={26} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
            {user?.name}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{user?.email}</Text>
        </View>
        <ChevronRight size={18} color={c.accentDark} />
      </Pressable>
      <View
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {rows.map(({ label, Icon, section, value }, index) => (
          <Pressable
            key={section}
            accessibilityRole="button"
            onPress={() =>
              section === "help"
                ? router.push("/help")
                : router.push({ pathname: "/settings", params: { section } })
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 60,
              paddingHorizontal: 15,
              borderBottomWidth: index === rows.length - 1 ? 0 : 0.5,
              borderColor: c.border,
            }}
          >
            <Icon color={c.text} size={19} />
            <Text style={{ flex: 1, color: c.text, fontSize: 14 }}>
              {label}
            </Text>
            {value ? (
              <Text
                numberOfLines={1}
                style={{ color: c.muted, fontSize: 11, maxWidth: 130 }}
              >
                {value}
              </Text>
            ) : null}
            <ChevronRight color={c.muted} size={16} />
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setConfirm(true)}
        style={{
          marginTop: 24,
          padding: 18,
          borderRadius: 14,
          backgroundColor: c.surface2,
        }}
      >
        <Text style={{ color: c.danger, fontSize: 14, fontWeight: "600" }}>
          Sign out
        </Text>
      </Pressable>
      <ConfirmSheet
        visible={confirm}
        title="Sign out?"
        confirm="Sign out"
        busy={loading}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void signOut()}
      >
        <Text style={{ color: c.muted, lineHeight: 22, marginBottom: 22 }}>
          Your data stays in your account. Scheduled reminders on this device
          will be cancelled.
        </Text>
      </ConfirmSheet>
    </Screen>
  );
}
