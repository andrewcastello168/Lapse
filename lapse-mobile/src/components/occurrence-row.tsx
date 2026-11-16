import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StorageImage } from "@/components/storage-image";
import { useThemeColors } from "@/context/preferences";
import { formatDate } from "@/utils/item-dates";
import type { TimelineOccurrence } from "@/types/models";
export function OccurrenceRow({ event }: { event: TimelineOccurrence }) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/item/[id]",
          params: { id: event.userItemId },
        })
      }
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        minHeight: 73,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderColor: c.border,
      }}
    >
      <StorageImage
        uri={event.image_url}
        fallbackUri={event.category_image_url}
        size={42}
      />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
          {event.itemName}
        </Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>
          {formatDate(event.occurrenceDate)}
          {event.projected
            ? " · Projection"
            : event.renewalMode === "MANUAL"
              ? " · Manual renewal"
              : ""}
        </Text>
      </View>
    </Pressable>
  );
}
