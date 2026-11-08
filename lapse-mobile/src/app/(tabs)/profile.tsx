import { useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import {
    Bell,
    ChevronRight,
    HelpCircle,
    Info,
    LogOut,
    Palette,
    Smartphone,
    Trash2,
} from "lucide-react-native";
import { Card } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { colors, spacing } from "@/constants/theme";

const rows = [
    ["Notifications", Bell],
    ["Appearance", Palette],
    ["Logged in Devices", Smartphone],
    ["Help & Support", HelpCircle],
    ["About", Info],
] as const;

export default function Profile() {
    const { user, signOut } = useAuth();
    const [notifications, setNotifications] = useState(true);

    const confirmSignOut = () => {
        Alert.alert("Sign out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: signOut },
        ]);
    };

    const initials = (user?.name ?? "Lapse")
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("");

    return (
        <View style={styles.root}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.heading}>Profile</Text>
                <View style={styles.profile}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <Text style={styles.name}>
                        {user?.name ?? "Lapse user"}
                    </Text>
                    <Text style={styles.email}>
                        {user?.email ?? "Not signed in"}
                    </Text>
                </View>

                <Card style={styles.menu}>
                    {rows.map(([label, Icon]) => (
                        <Pressable
                            key={label}
                            style={styles.row}
                            onPress={() =>
                                Alert.alert(
                                    label,
                                    label === "Notifications"
                                        ? "Use the switch to control reminder notifications."
                                        : "This setting is not connected to a backend endpoint yet.",
                                )
                            }
                        >
                            <Icon color={colors.muted} size={18} />
                            <Text style={styles.label}>{label}</Text>
                            {label === "Notifications" ? (
                                <Switch
                                    value={notifications}
                                    onValueChange={setNotifications}
                                    trackColor={{
                                        false: colors.surface2,
                                        true: colors.accentDark,
                                    }}
                                    thumbColor={
                                        notifications
                                            ? colors.accent
                                            : colors.muted
                                    }
                                />
                            ) : (
                                <ChevronRight color={colors.muted} size={17} />
                            )}
                        </Pressable>
                    ))}
                </Card>

                <Pressable
                    onPress={() =>
                        Alert.alert(
                            "Delete Account",
                            "Account deletion is not available because the backend does not expose a delete-account endpoint.",
                        )
                    }
                >
                    <Card style={styles.menu}>
                        <View style={styles.row}>
                            <Trash2 color={colors.danger} size={18} />
                            <Text style={[styles.label, styles.danger]}>
                                Delete Account
                            </Text>
                            <ChevronRight color={colors.danger} size={17} />
                        </View>
                    </Card>
                </Pressable>

                <Pressable style={styles.signout} onPress={confirmSignOut}>
                    <LogOut color={colors.danger} size={17} />
                    <Text style={styles.signText}>Sign Out</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: 110,
    },
    heading: {
        color: colors.text,
        fontSize: 30,
        fontWeight: "900",
        marginTop: 12,
    },
    profile: {
        alignItems: "center",
        marginVertical: spacing.xl,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surface2,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    avatarText: {
        color: colors.text,
        fontSize: 28,
        fontWeight: "900",
    },
    name: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "900",
    },
    email: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 5,
    },
    menu: {
        paddingHorizontal: 0,
        marginBottom: spacing.md,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        minHeight: 56,
    },
    label: {
        color: colors.text,
        flex: 1,
        marginLeft: 12,
        fontSize: 14,
    },
    danger: {
        color: colors.danger,
    },
    signout: {
        height: 50,
        borderRadius: 12,
        backgroundColor: "#2D1A20",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        marginTop: spacing.md,
    },
    signText: {
        color: colors.danger,
        fontWeight: "900",
    },
});
