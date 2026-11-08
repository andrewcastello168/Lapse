import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Bell, ChevronRight, Plus } from "lucide-react-native";
import { Card, SectionTitle } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { api } from "@/services/api";
import type { TimelineOccurrence } from "@/types/models";
import { useAuth } from "@/context/auth";

function dateOnly(value: string): string {
    return value.slice(0, 10);
}

function daysUntil(value: string): number {
    const target = new Date(`${dateOnly(value)}T00:00:00`).getTime();
    const today = new Date();
    const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    ).getTime();
    return Math.round((target - start) / 86_400_000);
}

function formatDate(value: string): string {
    return new Date(`${dateOnly(value)}T00:00:00`).toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        },
    );
}

function describeDays(value: number): string {
    if (value < 0) {
        return "Expired";
    }
    if (value === 0) {
        return "Today";
    }
    if (value === 1) {
        return "Tomorrow";
    }
    return `${value} days`;
}

export default function Home() {
    const { user } = useAuth();
    const [upcoming, setUpcoming] = useState<TimelineOccurrence[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const today = new Date();
        const from = today.toISOString().slice(0, 10);
        const to = new Date(
            today.getFullYear(),
            today.getMonth() + 3,
            today.getDate() + 1,
        )
            .toISOString()
            .slice(0, 10);
        setLoading(true);

        try {
            const result = await api.timeline(from, to);
            setUpcoming(result.data);
        } catch (reason: unknown) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : "Unable to load your timeline.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const initials = (user?.name ?? "Lapse")
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("");

    return (
        <View style={styles.root}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.top}>
                    <View>
                        <Text style={styles.kicker}>LAPSE</Text>
                        <Text style={styles.greeting}>
                            Good{" "}
                            {new Date().getHours() < 12
                                ? "morning"
                                : new Date().getHours() < 18
                                  ? "afternoon"
                                  : "evening"}
                        </Text>
                    </View>
                    <View style={styles.actions}>
                        <Bell color={colors.text} size={20} />
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                    </View>
                </View>

                <Card style={styles.period}>
                    <Text style={styles.periodText}>
                        Upcoming in{" "}
                        <Text style={{ color: colors.accent }}>3 months</Text>
                    </Text>
                    <ChevronRight color={colors.muted} size={18} />
                </Card>

                <SectionTitle
                    title="Upcoming"
                    action="See all"
                    onPress={() => router.push("/(tabs)/items")}
                />

                {loading ? <ActivityIndicator color={colors.accent} /> : null}
                {upcoming.map((item) => (
                    <Card
                        key={`${item.userItemId}-${item.occurrenceDate}`}
                        style={styles.item}
                    >
                        <View style={styles.itemMain}>
                            <Text style={styles.name}>{item.itemName}</Text>
                            <Text style={styles.meta}>
                                {formatDate(item.occurrenceDate)}
                            </Text>
                        </View>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {describeDays(daysUntil(item.occurrenceDate))}
                            </Text>
                        </View>
                    </Card>
                ))}

                {upcoming.length === 0 && !loading ? (
                    <Card style={styles.empty}>
                        <Text style={styles.emptyTitle}>
                            Nothing expiring soon
                        </Text>
                        <Text style={styles.meta}>
                            Add a document or subscription to get reminders.
                        </Text>
                    </Card>
                ) : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable onPress={() => router.push("/add-flow" as never)}>
                    <View style={styles.addCard}>
                        <View style={styles.plus}>
                            <Plus color={colors.bg} />
                        </View>
                        <View>
                            <Text style={styles.name}>
                                Stay ahead of deadlines
                            </Text>
                            <Text style={styles.meta}>
                                Add a document or subscription
                            </Text>
                        </View>
                    </View>
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
    top: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    kicker: {
        color: colors.accent,
        fontWeight: "900",
        letterSpacing: 2,
        fontSize: 12,
    },
    greeting: {
        color: colors.text,
        fontSize: 24,
        fontWeight: "900",
        marginTop: 5,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 20,
        backgroundColor: colors.surface2,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: colors.text,
        fontWeight: "900",
    },
    period: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    periodText: {
        color: colors.text,
        fontSize: 14,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.sm,
        padding: 12,
    },
    itemMain: {
        flex: 1,
    },
    name: {
        color: colors.text,
        fontWeight: "800",
        fontSize: 14,
    },
    meta: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 4,
    },
    badge: {
        backgroundColor: "#49252B",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    badgeText: {
        color: "#FF7680",
        fontSize: 11,
        fontWeight: "900",
    },
    empty: {
        alignItems: "center",
    },
    emptyTitle: {
        color: colors.text,
        fontWeight: "800",
    },
    error: {
        color: colors.danger,
        marginBottom: spacing.sm,
    },
    addCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.accentDark,
        backgroundColor: "#0A2929",
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        marginTop: spacing.md,
    },
    plus: {
        width: 38,
        height: 38,
        borderRadius: 20,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
});
