import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Bell, ChevronRight } from "lucide-react-native";
import { Screen, SectionTitle } from "@/components/ui";
import { Feedback } from "@/components/feedback";
import { ItemRow } from "@/components/item-row";
import { StorageImage } from "@/components/storage-image";
import { usePreferences } from "@/context/preferences";
import { useAuth } from "@/context/auth";
import { api } from "@/services/api";
import type { Category, TimelinePage, UserItem } from "@/types/models";
export const windows = [
  ["7D", "7D"],
  ["30D", "30D"],
  ["3M", "3M"],
  ["6M", "6M"],
  ["12M", "1Y"],
  ["All", "All"],
] as const;
export default function Home() {
  const { colors: c, timezone } = usePreferences();
  const { user } = useAuth();
  const [window, setWindow] = useState("3M");
  const [items, setItems] = useState<UserItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [range, setRange] = useState<TimelinePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      Promise.all([
        api.userItems(timezone),
        api.categories(),
        window === "All"
          ? Promise.resolve(null)
          : api.timeline(undefined, undefined, window, timezone),
      ])
        .then(([tracked, catalog, timeline]) => {
          if (active) {
            setItems(tracked);
            setCategories(catalog);
            setRange(timeline);
          }
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to load your dashboard",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
      // Retry intentionally restarts the focused request.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [window, timezone, retry]),
  );
  const sorted = [...items].sort((a, b) =>
    (a.effective_expiry_date ?? "9999").localeCompare(
      b.effective_expiry_date ?? "9999",
    ),
  );
  const overdue = sorted.filter((item) => item.expiration_status === "OVERDUE");
  const upcoming = sorted.filter((item) =>
    window === "All"
      ? item.expiration_status !== "OVERDUE"
      : item.days_remaining !== null &&
        item.days_remaining >= 0 &&
        !!range &&
        item.effective_expiry_date! <= range.to,
  );
  const attention = items.filter((item) =>
    ["OVERDUE", "DUE_TODAY", "EXPIRING_SOON"].includes(item.expiration_status),
  ).length;
  const open = (item: UserItem) =>
    router.push({ pathname: "/item/[id]", params: { id: item.id } });
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          marginBottom: 20,
        }}
      >
        <Image
          source={require("@/assets/images/branding/logo-mark.png")}
          style={{ width: 32, height: 32 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push("/notifications")}
          style={{ padding: 10 }}
        >
          <Bell color={c.text} size={22} />
        </Pressable>
      </View>
      <Text
        style={{
          color: c.text,
          fontSize: 29,
          fontWeight: "700",
          letterSpacing: -0.8,
        }}
      >
        Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}{" "}
        <Text style={{ fontSize: 24 }}>☀</Text>
      </Text>
      <Text
        style={{ color: c.muted, fontSize: 14, marginTop: 7, marginBottom: 22 }}
      >
        Here’s what’s coming up
        {user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
      </Text>
      <View
        style={{
          flexDirection: "row",
          padding: 4,
          borderRadius: 15,
          backgroundColor: c.surface2,
          marginBottom: 20,
        }}
      >
        {windows.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: window === value }}
            onPress={() => setWindow(value)}
            style={{
              flex: 1,
              minHeight: 37,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: window === value ? c.accent : "transparent",
            }}
          >
            <Text
              style={{
                color: window === value ? "white" : c.muted,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Feedback
        loading={loading}
        error={error}
        retry={() => setRetry((n) => n + 1)}
      />
      {!loading && !error ? (
        <>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 25 }}>
            <View
              style={{
                flex: 1,
                padding: 18,
                backgroundColor: c.accentTint,
                borderRadius: 18,
              }}
            >
              <Text
                style={{ color: c.accentDark, fontSize: 32, fontWeight: "700" }}
              >
                {items.length}
              </Text>
              <Text style={{ color: c.accentDark, fontSize: 12, marginTop: 5 }}>
                Total items
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                padding: 18,
                backgroundColor: c.surface2,
                borderRadius: 18,
              }}
            >
              <Text style={{ color: c.text, fontSize: 32, fontWeight: "700" }}>
                {attention}
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 5 }}>
                Need attention
              </Text>
            </View>
          </View>
          {overdue.length ? (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  color: c.danger,
                  fontWeight: "700",
                  fontSize: 15,
                  marginBottom: 5,
                }}
              >
                Overdue ({overdue.length})
              </Text>
              {overdue.map((item) => (
                <ItemRow key={item.id} item={item} onPress={() => open(item)} />
              ))}
            </View>
          ) : null}
          <SectionTitle
            title={
              window === "All" ? "Your items" : `Upcoming (${upcoming.length})`
            }
            action="Timeline"
            onPress={() =>
              router.push({ pathname: "/timeline", params: { window } })
            }
          />
          {upcoming.map((item) => (
            <ItemRow key={item.id} item={item} onPress={() => open(item)} />
          ))}
          <Feedback
            empty={!upcoming.length}
            title={
              items.length
                ? "You’re all caught up"
                : "Stay ahead of your next renewal"
            }
            message={
              items.length
                ? "No upcoming dates in this window. Overdue items always appear above."
                : "Add your first subscription, document, or important date."
            }
          />
          {range && upcoming.length ? (
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 10 }}>
              {range.total} scheduled{" "}
              {range.total === 1 ? "occurrence" : "occurrences"} ·{" "}
              {range.itemCount} {range.itemCount === 1 ? "item" : "items"}
            </Text>
          ) : null}
          <View style={{ marginTop: 28 }}>
            <SectionTitle
              title="Categories"
              action="View all"
              onPress={() => router.push("/categories")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
            >
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/items",
                      params: { category: String(category.id) },
                    })
                  }
                  style={{
                    minWidth: 94,
                    alignItems: "center",
                    padding: 14,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 18,
                    gap: 10,
                  }}
                >
                  <StorageImage uri={category.image_url} size={38} />
                  <Text
                    style={{ color: c.text, fontSize: 12, fontWeight: "500" }}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/add-flow")}
            style={{
              marginTop: 24,
              padding: 18,
              borderRadius: 16,
              backgroundColor: c.accentTint,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: c.accentDark, fontWeight: "600" }}>
              Track another important date
            </Text>
            <ChevronRight size={18} color={c.accentDark} />
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}
