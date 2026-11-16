import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen } from "@/components/ui";
import { Feedback } from "@/components/feedback";
import { OccurrenceRow } from "@/components/occurrence-row";
import { ItemRow } from "@/components/item-row";
import { usePreferences } from "@/context/preferences";
import { api } from "@/services/api";
import type {
  TimelineOccurrence,
  TimelinePage,
  UserItem,
} from "@/types/models";
import { parseDate } from "@/utils/item-dates";
const options = [
  ["7D", "7D"],
  ["30D", "30D"],
  ["3M", "3M"],
  ["6M", "6M"],
  ["12M", "1Y"],
  ["All", "All"],
];
export default function Timeline() {
  const params = useLocalSearchParams<{ window?: string }>();
  const [window, setWindow] = useState(params.window ?? "3M");
  const { colors: c, timezone } = usePreferences();
  const [items, setItems] = useState<UserItem[]>([]);
  const [page, setPage] = useState<TimelinePage | null>(null);
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
        window === "All"
          ? Promise.resolve(null)
          : api.timeline(undefined, undefined, window, timezone),
      ])
        .then(([tracked, result]) => {
          if (active) {
            setItems(tracked);
            setPage(result);
          }
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to load timeline",
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
  const groups = new Map<string, TimelineOccurrence[]>();
  for (const event of page?.data ?? []) {
    const key = event.occurrenceDate.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return (
    <Screen
      title={window === "All" ? "All tracked items" : "Upcoming timeline"}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/(tabs)")
      }
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: c.surface2,
          padding: 4,
          borderRadius: 14,
          marginVertical: 18,
        }}
      >
        {options.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: window === value }}
            onPress={() => setWindow(value)}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: window === value ? c.accent : "transparent",
              borderRadius: 11,
            }}
          >
            <Text
              style={{
                color: window === value ? "white" : c.muted,
                fontSize: 12,
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
          {window === "All" ? (
            sorted.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onPress={() =>
                  router.push({
                    pathname: "/item/[id]",
                    params: { id: item.id },
                  })
                }
              />
            ))
          ) : (
            <>
              {overdue.length ? (
                <>
                  <Text
                    style={{
                      color: c.danger,
                      fontSize: 16,
                      fontWeight: "700",
                      marginVertical: 14,
                    }}
                  >
                    Overdue ({overdue.length})
                  </Text>
                  {overdue.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onPress={() =>
                        router.push({
                          pathname: "/item/[id]",
                          params: { id: item.id },
                        })
                      }
                    />
                  ))}
                </>
              ) : null}
              {[...groups].map(([month, events]) => (
                <View key={month} style={{ marginTop: 18 }}>
                  <Text
                    style={{
                      color: c.text,
                      fontSize: 15,
                      fontWeight: "700",
                      backgroundColor: c.surface2,
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    {parseDate(month + "-01")?.toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                  {events.map((event) => (
                    <OccurrenceRow
                      key={event.userItemId + event.occurrenceDate}
                      event={event}
                    />
                  ))}
                </View>
              ))}
            </>
          )}
          <Feedback
            empty={
              window === "All" ? !items.length : !page?.total && !overdue.length
            }
            title="No dates in this window"
            message="Try another date range or view all tracked items."
          />
          {page ? (
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 20 }}>
              {page.total} occurrences · {page.itemCount} unique items
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
