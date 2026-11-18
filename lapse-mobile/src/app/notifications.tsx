import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/components/typography";
import { Bell, ChevronRight } from "lucide-react-native";
import { Screen } from "@/components/ui";
import { Feedback } from "@/components/feedback";
import { StorageImage } from "@/components/storage-image";
import { usePreferences } from "@/context/preferences";
import { useLocalNotifications } from "@/context/notifications";
import { useTrackedItems } from "@/hooks/use-tracked-items";
export default function NotificationsScreen() {
  const { colors: c } = usePreferences();
  const local = useLocalNotifications();
  const { items, loading, error, reload } = useTrackedItems();
  const attention = items
    .filter((item) =>
      ["OVERDUE", "DUE_TODAY", "EXPIRING_SOON"].includes(
        item.expiration_status,
      ),
    )
    .sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0));
  return (
    <Screen
      title={`Notifications (${local.unread} unread)`}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/(tabs)")
      }
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/settings?section=notifications")}
        style={{
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          padding: 16,
          backgroundColor: c.accentTint,
          borderRadius: 16,
          marginVertical: 18,
        }}
      >
        <Bell color={c.accentDark} size={20} />
        <Text style={{ color: c.accentDark, fontSize: 13, flex: 1 }}>
          Manage reminders and permissions
        </Text>
        <ChevronRight size={17} color={c.accentDark} />
      </Pressable>
      <Feedback loading={loading} error={error} retry={reload} />
      {!loading && !error && attention.length ? (
        <>
          <Text
            style={{
              color: c.text,
              fontSize: 16,
              fontWeight: "700",
              marginVertical: 14,
            }}
          >
            Needs your attention
          </Text>
          {attention.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: "/item/[id]", params: { id: item.id } })
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 16,
                borderBottomWidth: 0.5,
                borderColor: c.border,
              }}
            >
              <StorageImage
                uri={item.image_url}
                fallbackUri={item.category_image_url}
                size={42}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{ color: c.text, fontWeight: "600", fontSize: 14 }}
                >
                  {item.item_name}
                  {item.days_remaining! < 0
                    ? " is overdue"
                    : item.days_remaining === 0
                      ? " is due today"
                      : " is expiring soon"}
                </Text>
                <Text
                  style={{
                    color: item.days_remaining! < 0 ? c.danger : c.muted,
                    fontSize: 12,
                    lineHeight: 19,
                  }}
                >
                  {item.days_remaining! < 0
                    ? Math.abs(item.days_remaining!) + " days overdue"
                    : item.days_remaining === 0
                      ? "Due today"
                      : "Expires in " + item.days_remaining + " days"}{" "}
                  · {item.effective_expiry_date}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : null}
      {local.inbox.length ? (
        <>
          <Text
            style={{
              color: c.text,
              fontSize: 16,
              fontWeight: "700",
              marginTop: 28,
              marginBottom: 10,
            }}
          >
            Recent reminders
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void local.markAllRead()}
            style={{ padding: 14 }}
          >
            <Text style={{ color: c.accentDark }}>Mark all read</Text>
          </Pressable>
          {local.inbox.map((entry) => {
            const item = items.find((row) => row.id === entry.itemId);
            return (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                onPress={() => {
                  void local.markRead(entry.id);
                  if (!entry.itemId || !item) return;
                  router.push({
                    pathname: "/item/[id]",
                    params: { id: entry.itemId },
                  });
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 16,
                  borderBottomWidth: 0.5,
                  borderColor: c.border,
                }}
              >
                <StorageImage
                  uri={item?.image_url}
                  fallbackUri={item?.category_image_url}
                  size={42}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text
                    style={{
                      color: c.text,
                      fontSize: 14,
                      fontWeight: entry.read ? "400" : "600",
                    }}
                  >
                    {entry.title}
                  </Text>
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}
                  >
                    {entry.body}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 11 }}>
                    {new Date(entry.date).toLocaleString()}
                  </Text>
                </View>
                {!entry.read ? (
                  <View
                    style={{
                      height: 6,
                      width: 6,
                      borderRadius: 3,
                      backgroundColor: c.accent,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </>
      ) : null}
      <Feedback
        empty={!loading && !error && !attention.length && !local.inbox.length}
        title="You’re all caught up"
        message="Reminders and items needing attention will appear here."
      />
    </Screen>
  );
}
