import { Pressable, Text, View } from "react-native";
import { StorageImage } from "@/components/storage-image";
import { useThemeColors } from "@/context/preferences";
import { formatDate } from "@/utils/item-dates";
import type { UserItem } from "@/types/models";
export function itemDueDate(item: UserItem) {
  return item.effective_expiry_date;
}
export function DueBadge({
  days,
  status,
}: {
  days: number | null;
  status?: string;
}) {
  const c = useThemeColors();
  const urgent = days !== null && days <= 0;
  return (
    <Text
      style={{
        color: urgent ? c.danger : c.accentDark,
        fontSize: 13,
        fontWeight: "700",
      }}
    >
      {days === null
        ? "∞"
        : days < 0
          ? `${Math.abs(days)}d late`
          : days === 0
            ? "Due today"
            : `${days}d`}
      {status === "EXPIRING_SOON" ? " · Soon" : ""}
    </Text>
  );
}
export function ItemRow({
  item,
  onPress,
}: {
  item: UserItem;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.item_name}, ${item.expiration_status.replaceAll("_", " ").toLowerCase()}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 74,
        borderBottomWidth: 0.5,
        borderColor: c.border,
        paddingVertical: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <StorageImage
        uri={item.image_url}
        fallbackUri={item.category_image_url}
        size={44}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{ color: c.text, fontSize: 15, fontWeight: "600" }}
        >
          {item.item_name}
        </Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>
          {item.category_name}
          {item.renewal_mode === "MANUAL" ? " · Manual" : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <DueBadge days={item.days_remaining} status={item.expiration_status} />
        {item.effective_expiry_date ? (
          <Text style={{ color: c.muted, fontSize: 11 }}>
            {formatDate(item.effective_expiry_date)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
