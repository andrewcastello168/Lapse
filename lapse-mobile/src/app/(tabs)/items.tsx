import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Search, SlidersHorizontal } from "lucide-react-native";
import { Card } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { api } from "@/services/api";
import type { TimelineOccurrence } from "@/types/models";

type Filter = "All" | "Active" | "Expired";

const filters: Filter[] = ["All", "Active", "Expired"];

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

export default function Items() {
    const [items, setItems] = useState<TimelineOccurrence[]>([]);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("All");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState<TimelineOccurrence | null>(null);

    const load = useCallback(async () => {
        const today = new Date();
        const from = new Date(
            today.getFullYear() - 1,
            today.getMonth(),
            today.getDate(),
        )
            .toISOString()
            .slice(0, 10);
        const to = new Date(
            today.getFullYear() + 1,
            today.getMonth(),
            today.getDate(),
        )
            .toISOString()
            .slice(0, 10);
        setLoading(true);

        try {
            const result = await api.timeline(from, to);
            setItems(result.data);
        } catch (reason: unknown) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : "Unable to load your items.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const data = useMemo(() => {
        const queryText = query.trim().toLowerCase();
        const today = new Date();
        const todayTime = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
        ).getTime();

        return items.filter((item) => {
            const matchesQuery = item.itemName
                .toLowerCase()
                .includes(queryText);
            const isExpired =
                new Date(
                    `${dateOnly(item.occurrenceDate)}T00:00:00`,
                ).getTime() < todayTime;
            const matchesFilter =
                filter === "All" ||
                (filter === "Expired" ? isExpired : !isExpired);
            return matchesQuery && matchesFilter;
        });
    }, [filter, items, query]);

    return (
        <View style={styles.root}>
            <FlatList
                contentContainerStyle={styles.content}
                data={data}
                keyExtractor={(item) =>
                    `${item.userItemId}-${item.occurrenceDate}`
                }
                renderItem={({ item }) => (
                    <Pressable onPress={() => setSelected(item)}>
                        <Card style={styles.item}>
                            <View style={styles.main}>
                                <Text style={styles.name}>{item.itemName}</Text>
                                <Text style={styles.meta}>
                                    {formatDate(item.occurrenceDate)} ·{" "}
                                    {item.expiryType}
                                </Text>
                            </View>
                            <Text style={styles.days}>
                                {daysUntil(item.occurrenceDate) < 0
                                    ? "Expired"
                                    : `${daysUntil(item.occurrenceDate)} days`}
                            </Text>
                        </Card>
                    </Pressable>
                )}
                ListHeaderComponent={
                    <>
                        <Text style={styles.heading}>My Items</Text>
                        <Text style={styles.sub}>
                            Everything important, in one place.
                        </Text>
                        <View style={styles.search}>
                            <Search color={colors.muted} size={18} />
                            <TextInput
                                placeholder="Search items..."
                                placeholderTextColor={colors.muted}
                                value={query}
                                onChangeText={setQuery}
                                style={styles.input}
                            />
                            <SlidersHorizontal color={colors.muted} size={18} />
                        </View>
                        <View style={styles.filters}>
                            {filters.map((item) => (
                                <Pressable
                                    key={item}
                                    onPress={() => setFilter(item)}
                                    style={[
                                        styles.filter,
                                        filter === item && styles.selected,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.filterText,
                                            filter === item &&
                                                styles.selectedText,
                                        ]}
                                    >
                                        {item}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </>
                }
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {loading ? "" : "No items match this filter."}
                    </Text>
                }
            />

            {selected ? (
                <Pressable
                    style={styles.overlay}
                    onPress={() => setSelected(null)}
                >
                    <Card style={styles.detail}>
                        <Text style={styles.name}>{selected.itemName}</Text>
                        <Text style={styles.meta}>
                            Expiry type: {selected.expiryType}
                        </Text>
                        <Text style={styles.meta}>
                            Next occurrence:{" "}
                            {formatDate(selected.occurrenceDate)}
                        </Text>
                        <Text style={styles.meta}>
                            Category ID: {String(selected.categoryId)}
                        </Text>
                        <Text style={styles.unavailable}>
                            Editing and deletion are not available because the
                            backend has no update or delete user-item endpoints.
                        </Text>
                    </Card>
                </Pressable>
            ) : null}

            {loading ? <ActivityIndicator color={colors.accent} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
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
    sub: {
        color: colors.muted,
        marginTop: 6,
        marginBottom: spacing.lg,
    },
    search: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        gap: 8,
    },
    input: {
        flex: 1,
        color: colors.text,
    },
    filters: {
        flexDirection: "row",
        gap: 8,
        marginVertical: spacing.md,
    },
    filter: {
        backgroundColor: colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 9,
    },
    filterText: {
        color: colors.muted,
        fontSize: 11,
    },
    selected: {
        backgroundColor: colors.accent,
    },
    selectedText: {
        color: colors.bg,
        fontWeight: "800",
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        marginBottom: 8,
    },
    main: {
        flex: 1,
    },
    name: {
        color: colors.text,
        fontWeight: "800",
    },
    meta: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 4,
    },
    days: {
        color: colors.accent,
        fontWeight: "900",
        fontSize: 11,
    },
    empty: {
        color: colors.muted,
        textAlign: "center",
        marginTop: 48,
    },
    overlay: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: "rgba(6,19,22,0.82)",
        justifyContent: "center",
        padding: spacing.lg,
    },
    detail: {
        gap: spacing.xs,
    },
    unavailable: {
        color: colors.warning,
        fontSize: 12,
        lineHeight: 18,
        marginTop: spacing.sm,
    },
    error: {
        color: colors.danger,
        margin: spacing.lg,
    },
});
