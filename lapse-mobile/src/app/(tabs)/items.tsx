import { useThemeColors } from "@/context/preferences";
import { useMemo, useState } from "react";
import { router } from "expo-router";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { ListFilter, Search } from "lucide-react-native";
import { Screen } from "@/components/ui";
import { ItemRow, itemDueDate } from "@/components/item-row";
import { useTrackedItems } from "@/hooks/use-tracked-items";
import type { Palette } from "@/constants/theme";
import { daysUntil } from "@/utils/item-dates";

const filters = ["All", "Active", "Expired", "No Expiry"] as const;
export default function Items() {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const { items, loading, error, reload } = useTrackedItems();
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<(typeof filters)[number]>("All");
    const data = useMemo(
        () =>
            items
                .filter((item) => {
                    if (
                        !item.item_name
                            .toLowerCase()
                            .includes(query.trim().toLowerCase())
                    )
                        return false;
                    const due = itemDueDate(item);
                    return (
                        filter === "All" ||
                        (filter === "No Expiry"
                            ? item.expiry_type === "NEVER"
                            : filter === "Expired"
                              ? !!due && daysUntil(due) < 0
                              : item.expiry_type !== "NEVER" &&
                                !!due &&
                                daysUntil(due) >= 0)
                    );
                })
                .sort((a, b) =>
                    (itemDueDate(a) ?? "9999").localeCompare(
                        itemDueDate(b) ?? "9999",
                    ),
                ),
        [filter, items, query],
    );
    return (
        <Screen title="My Items" scroll={false}>
            <FlatList
                data={data}
                contentContainerStyle={s.content}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item) => String(item.id)}
                refreshing={loading}
                onRefresh={reload}
                renderItem={({ item }) => (
                    <ItemRow
                        item={item}
                        onPress={() =>
                            router.push({
                                pathname: "/item/[id]",
                                params: { id: String(item.id) },
                            })
                        }
                    />
                )}
                ListHeaderComponent={
                    <>
                        <View style={s.search}>
                            <Search color={colors.muted} size={17} />
                            <TextInput
                                accessibilityLabel="Search items"
                                placeholder="Search items..."
                                placeholderTextColor={colors.muted}
                                value={query}
                                onChangeText={setQuery}
                                style={s.input}
                            />
                            <ListFilter color={colors.muted} size={17} />
                        </View>
                        <View style={s.filters}>
                            {filters.map((option) => (
                                <Pressable
                                    key={option}
                                    accessibilityRole="tab"
                                    accessibilityState={{
                                        selected: option === filter,
                                    }}
                                    onPress={() => setFilter(option)}
                                    style={[
                                        s.filter,
                                        filter === option && s.active,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            s.filterText,
                                            filter === option && s.activeText,
                                        ]}
                                    >
                                        {option}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        {error ? (
                            <Pressable onPress={reload}>
                                <Text selectable style={s.error}>
                                    {error} Tap to retry.
                                </Text>
                            </Pressable>
                        ) : null}
                    </>
                }
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator color={colors.accent} />
                    ) : !error ? (
                        <Text style={s.empty}>No items match this filter.</Text>
                    ) : null
                }
            />
        </Screen>
    );
}
const createStyles = (colors: Palette) =>
    StyleSheet.create({
        content: { flexGrow: 1, padding: 16, paddingTop: 8 },
        search: {
            minHeight: 44,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            gap: 8,
        },
        input: {
            flex: 1,
            color: colors.text,
            fontSize: 14,
            paddingVertical: 10,
        },
        filters: { flexDirection: "row", gap: 6, marginVertical: 14 },
        filter: {
            flex: 1,
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 7,
            paddingHorizontal: 5,
        },
        filterText: { color: colors.muted, fontSize: 12 },
        active: { backgroundColor: colors.accent },
        activeText: { color: colors.onAccent, fontWeight: "700" },
        empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
        error: { color: colors.danger, marginBottom: 12 },
    });
