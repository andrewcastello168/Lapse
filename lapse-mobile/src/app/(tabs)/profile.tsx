import { usePreferences, useThemeColors } from "@/context/preferences";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
    Bell,
    ChevronRight,
    HelpCircle,
    Info,
    Palette,
    Smartphone,
    UserRound,
} from "lucide-react-native";
import { Screen } from "@/components/ui";
import { useAuth } from "@/context/auth";
import type { Palette as ThemePalette } from "@/constants/theme";

const rows = [
    ["Account Settings", UserRound, "account"],
    ["Notifications", Bell, "notifications"],
    ["Appearance", Palette, "appearance"],
    ["Logged in Devices", Smartphone, "devices"],
    ["Help & Support", HelpCircle, "help"],
    ["About", Info, "about"],
] as const;
export default function Profile() {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const { mode } = usePreferences();
    const { user, signOut } = useAuth();
    const confirmSignOut = () =>
        Alert.alert("Sign Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Sign Out",
                style: "destructive",
                onPress: () => {
                    void signOut();
                },
            },
        ]);
    return (
        <Screen title="Profile">
            <View style={s.profile}>
                <View style={s.avatar}>
                    <Text style={s.avatarText}>
                        {(user?.name ?? "L").charAt(0).toUpperCase()}
                    </Text>
                </View>
                <Text style={s.name}>{user?.name ?? "Lapse user"}</Text>
                <Text style={s.email}>{user?.email}</Text>
            </View>
            {rows.map(([label, Icon, section]) => (
                <Pressable
                    key={section}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                        s.row,
                        { opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() =>
                        section === "help" || section === "about"
                            ? Alert.alert(
                                  label,
                                  section === "about"
                                      ? "Lapse — keep track of your important documents and subscriptions."
                                      : "Help & Support is not connected yet.",
                              )
                            : router.push({
                                  pathname: "/settings",
                                  params: { section },
                              })
                    }
                >
                    <Icon color={colors.muted} size={18} />
                    <Text style={s.label}>{label}</Text>
                    {section === "appearance" ? (
                        <Text style={s.value}>{mode}</Text>
                    ) : null}
                    <ChevronRight size={16} color={colors.muted} />
                </Pressable>
            ))}
            <Pressable
                accessibilityRole="button"
                onPress={confirmSignOut}
                style={s.signout}
            >
                <Text style={s.signText}>Sign Out</Text>
            </Pressable>
        </Screen>
    );
}
const createStyles = (colors: ThemePalette) =>
    StyleSheet.create({
        profile: {
            alignItems: "center",
            paddingVertical: 16,
            marginBottom: 12,
        },
        avatar: {
            width: 74,
            height: 74,
            borderRadius: 37,
            backgroundColor: colors.surface2,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
        },
        avatarText: { color: colors.text, fontSize: 36, fontWeight: "700" },
        name: { color: colors.text, fontSize: 17, fontWeight: "700" },
        email: { color: colors.muted, fontSize: 13, marginTop: 4 },
        row: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minHeight: 50,
            paddingHorizontal: 12,
            marginBottom: 6,
        },
        label: { flex: 1, color: colors.text, fontSize: 14 },
        value: {
            backgroundColor: colors.surface2,
            color: colors.text,
            padding: 5,
            borderRadius: 5,
            fontSize: 12,
        },
        signout: {
            backgroundColor: colors.surface2,
            borderRadius: 8,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
        },
        signText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
    });
