import { CategoryIcon } from "@/components/category-icon";
import { useThemeColors } from "@/context/preferences";
import { StorageImage } from "@/components/storage-image";
import type { Palette } from "@/constants/theme";
import { daysUntil, formatDate, nextDueDate } from "@/utils/item-dates";
import type { UserItem } from "@/types/models";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function itemDueDate(item: UserItem) {
    if (item.expiry_type === "NEVER" || !item.expiry_date) return null;
    const start = item.expiry_date.slice(0, 10);
    return item.expiry_type === "RECURRING"
        ? nextDueDate(start, {
              years: item.recurrence_years ?? 0,
              months: item.recurrence_months ?? 0,
              days: item.recurrence_days ?? 0,
          })
        : start;
}
export function DueBadge({ date }: { date?: string | null }) {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const days = date ? daysUntil(date) : null;
    const backgroundColor =
        days === null
            ? colors.surface2
            : days <= 7
              ? colors.dangerBadge
              : days <= 45
                ? colors.warningBadge
                : colors.successBadge;
    return (
        <View style={[s.badge, { backgroundColor }]}>
            <Text
                style={[s.badgeText, days === null && { color: colors.text }]}
            >
                {days === null
                    ? "No expiry"
                    : days < 0
                      ? "Expired"
                      : days === 0
                        ? "Today"
                        : `${days} days`}
            </Text>
        </View>
    );
}
export function ItemRow({
    item,
    occurrenceDate,
    onPress,
}: {
    item: UserItem;
    occurrenceDate?: string;
    onPress: () => void;
}) {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const due = occurrenceDate ?? itemDueDate(item);
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
        >
            <>
                {item.mi_id ? (
                    <StorageImage path={item.image_path} size={44} />
                ) : (
                    <CategoryIcon
                        name={item.category_name}
                        path={item.category_image_path ?? item.image_path}
                        size={44}
                    />
                )}
            </>
            <View style={s.main}>
                <Text style={s.name}>{item.item_name}</Text>
                <Text style={s.meta}>{item.category_name}</Text>
            </View>
            <View style={s.right}>
                {due ? <Text style={s.date}>{formatDate(due)}</Text> : null}
                <DueBadge date={due} />
            </View>
        </Pressable>
    );
}
const createStyles = (colors: Palette) =>
    StyleSheet.create({
        row: {
            backgroundColor: colors.surface,
            borderRadius: 8,
            padding: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
        },
        main: { flex: 1 },
        name: { color: colors.text, fontSize: 14, fontWeight: "600" },
        meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
        right: { alignItems: "flex-end", gap: 6 },
        date: { color: colors.muted, fontSize: 12 },
        badge: {
            alignSelf: "flex-start",
            borderRadius: 5,
            paddingHorizontal: 8,
            paddingVertical: 5,
        },
        badgeText: { color: colors.badgeText, fontSize: 11, fontWeight: "700" },
    });
