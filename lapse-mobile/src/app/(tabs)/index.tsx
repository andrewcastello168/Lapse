import { useThemeColors } from "@/context/preferences";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    Bell,
    CalendarDays,
    Check,
    ChevronDown,
    Plus,
} from "lucide-react-native";
import { Image } from "expo-image";
import { Input, Screen, SectionTitle } from "@/components/ui";
import { ItemRow } from "@/components/item-row";
import type { Palette } from "@/constants/theme";
import { api } from "@/services/api";
import type { TimelineOccurrence, UserItem } from "@/types/models";
import { useAuth } from "@/context/auth";
import { dateOnly, parseDate } from "@/utils/item-dates";

const periods = [
    "1 month",
    "3 months",
    "6 months",
    "12 months",
    "Custom range",
];
export default function Home() {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const { user } = useAuth();
    const [upcoming, setUpcoming] = useState<TimelineOccurrence[]>([]);
    const [items, setItems] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [period, setPeriod] = useState("3 months");
    const [menu, setMenu] = useState(false);
    const [from, setFrom] = useState(dateOnly());
    const [to, setTo] = useState("");
    const generation = useRef(0);
    const custom = period === "Custom range";
    const load = useCallback(() => {
        const request = ++generation.current;
        if (custom && (!parseDate(from) || !parseDate(to) || from > to)) {
            setLoading(false);
            return;
        }
        const today = new Date();
        const end = new Date(
            today.getFullYear(),
            today.getMonth() + Number.parseInt(period),
            today.getDate(),
        );
        setLoading(true);
        setError("");
        Promise.all([
            api.timeline(
                custom ? from : dateOnly(today),
                custom ? to : dateOnly(end),
            ),
            api.userItems(),
        ])
            .then(([timeline, tracked]) => {
                if (generation.current === request) {
                    setUpcoming(timeline.data);
                    setItems(tracked);
                }
            })
            .catch((reason: unknown) => {
                if (generation.current === request)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Unable to load upcoming items.",
                    );
            })
            .finally(() => {
                if (generation.current === request) setLoading(false);
            });
    }, [custom, from, period, to]);
    useFocusEffect(
        useCallback(() => {
            load();
            return () => {
                generation.current++;
            };
        }, [load]),
    );
    const initial = (user?.name ?? "L").charAt(0).toUpperCase();
    const validRange =
        !custom || (parseDate(from) && parseDate(to) && from <= to);
    return (
        <Screen>
            <View style={s.top}>
                <View style={s.brand}>
                    <Image
                        source={require("@/assets/images/branding/logo-mark.png")}
                        style={s.logo}
                        contentFit="contain"
                    />
                    <Text style={s.brandText}>Lapse</Text>
                </View>
                <View style={s.actions}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Notifications"
                        onPress={() =>
                            router.push("/settings?section=notifications")
                        }
                        style={s.iconButton}
                    >
                        <Bell color={colors.text} size={21} />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Profile"
                        style={s.avatar}
                        onPress={() => router.push("/(tabs)/profile")}
                    >
                        <Text style={s.avatarText}>{initial}</Text>
                    </Pressable>
                </View>
            </View>
            <View style={s.periodContainer}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Upcoming date range"
                    accessibilityState={{ expanded: menu }}
                    style={s.period}
                    onPress={() => setMenu(!menu)}
                >
                    <Text style={s.periodText}>{period}</Text>
                    <ChevronDown size={16} color={colors.muted} />
                </Pressable>
                {menu ? (
                    <View style={s.menu}>
                        {periods.map((option) => (
                            <Pressable
                                key={option}
                                accessibilityRole="button"
                                onPress={() => {
                                    setPeriod(option);
                                    setMenu(false);
                                }}
                                style={s.menuRow}
                            >
                                <CalendarDays size={16} color={colors.text} />
                                <Text style={s.menuText}>{option}</Text>
                                {period === option ? (
                                    <Check size={16} color={colors.accent} />
                                ) : null}
                            </Pressable>
                        ))}
                    </View>
                ) : null}
            </View>
            {custom ? (
                <View style={s.custom}>
                    <Input
                        label="From (YYYY-MM-DD)"
                        value={from}
                        onChangeText={setFrom}
                    />
                    <Input
                        label="To (YYYY-MM-DD)"
                        value={to}
                        onChangeText={setTo}
                    />
                </View>
            ) : null}
            <SectionTitle
                title="Upcoming"
                action="See all"
                onPress={() => router.push("/(tabs)/items")}
            />
            {loading ? <ActivityIndicator color={colors.accent} /> : null}
            {validRange ? (
                upcoming
                    .filter(
                        (entry, index, rows) =>
                            rows.findIndex(
                                (other) =>
                                    String(other.userItemId) ===
                                    String(entry.userItemId),
                            ) === index,
                    )
                    .slice(0, 4)
                    .map((occurrence) => {
                        const item = items.find(
                            (row) =>
                                String(row.id) ===
                                String(occurrence.userItemId),
                        );
                        return item ? (
                            <ItemRow
                                key={`${occurrence.userItemId}-${occurrence.occurrenceDate}`}
                                item={item}
                                occurrenceDate={occurrence.occurrenceDate}
                                onPress={() =>
                                    router.push({
                                        pathname: "/item/[id]",
                                        params: { id: String(item.id) },
                                    })
                                }
                            />
                        ) : null;
                    })
            ) : (
                <Text style={s.empty}>Choose a valid date range.</Text>
            )}
            {!loading && !error && validRange && !upcoming.length ? (
                <Text style={s.empty}>Nothing expiring soon.</Text>
            ) : null}
            {error ? (
                <Pressable onPress={load}>
                    <Text selectable style={s.error}>
                        {error} Tap to retry.
                    </Text>
                </Pressable>
            ) : null}
            <View style={s.spacer} />
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add item"
                onPress={() => router.push("/add-flow")}
                style={({ pressed }) => [
                    s.add,
                    { opacity: pressed ? 0.75 : 1 },
                ]}
            >
                <Plus color={colors.onAccent} size={28} />
            </Pressable>
        </Screen>
    );
}
const createStyles = (colors: Palette) =>
    StyleSheet.create({
        top: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
            marginTop: 6,
        },
        brand: { flexDirection: "row", gap: 6, alignItems: "center" },
        logo: { width: 26, height: 26 },
        brandText: { color: colors.text, fontSize: 21, fontWeight: "700" },
        actions: { flexDirection: "row", alignItems: "center", gap: 12 },
        iconButton: {
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
        },
        avatar: {
            height: 36,
            width: 36,
            borderRadius: 18,
            backgroundColor: colors.surface2,
            alignItems: "center",
            justifyContent: "center",
        },
        avatarText: { color: colors.text, fontWeight: "700", fontSize: 17 },
        periodContainer: { zIndex: 2, marginBottom: 22 },
        period: {
            flexDirection: "row",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 28,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: colors.surface2,
            padding: 12,
        },
        periodText: { color: colors.text, fontSize: 14 },
        menu: {
            position: "absolute",
            top: 0,
            left: 0,
            minWidth: 180,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            borderRadius: 8,
        },
        menuRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            minHeight: 48,
            paddingHorizontal: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        menuText: { color: colors.text, fontSize: 14, flex: 1 },
        custom: { marginBottom: 8 },
        empty: {
            color: colors.muted,
            textAlign: "center",
            paddingVertical: 32,
        },
        error: { color: colors.danger, marginVertical: 16 },
        spacer: { flex: 1, minHeight: 30 },
        add: {
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
            marginBottom: 4,
        },
    });
