import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Screen } from "@/components/ui";
import { Feedback } from "@/components/feedback";
import { OccurrenceRow } from "@/components/occurrence-row";
import { usePreferences } from "@/context/preferences";
import { api } from "@/services/api";
import { dateOnly, formatDate } from "@/utils/item-dates";
import type { TimelinePage } from "@/types/models";
export default function Calendar() {
  const { colors: c, timezone } = usePreferences();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState(dateOnly());
  const [page, setPage] = useState<TimelinePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const from = dateOnly(month);
  const to = dateOnly(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      api
        .timeline(from, to, "3M", timezone)
        .then((result) => {
          if (active) setPage(result);
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to load calendar",
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
    }, [from, to, timezone, retry]),
  );
  const dates = useMemo(() => {
    const blanks = (month.getDay() + 6) % 7;
    const count = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: blanks }, () => null),
      ...Array.from({ length: count }, (_, i) => i + 1),
    ];
  }, [month]);
  const events =
    page?.data.filter((event) => event.occurrenceDate === selected) ?? [];
  function move(amount: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    if (next.getFullYear() < 1 || next.getFullYear() > 9998) return;
    setMonth(next);
    setSelected(dateOnly(next));
  }
  return (
    <Screen title="Calendar">
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 18,
          marginBottom: 23,
        }}
      >
        <Text
          style={{ flex: 1, fontSize: 20, fontWeight: "700", color: c.text }}
        >
          {month.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => move(-1)}
          style={{ padding: 12 }}
        >
          <ChevronLeft size={21} color={c.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => move(1)}
          style={{ padding: 12 }}
        >
          <ChevronRight size={21} color={c.text} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", marginBottom: 12 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <Text
            key={day}
            style={{
              width: "14.285%",
              textAlign: "center",
              fontSize: 11,
              color: c.muted,
            }}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6 }}>
        {dates.map((day, index) => {
          const value = day
            ? dateOnly(new Date(month.getFullYear(), month.getMonth(), day))
            : "";
          const active = value === selected;
          const has = page?.data.some(
            (event) => event.occurrenceDate === value,
          );
          return (
            <View
              key={index}
              style={{ width: "14.285%", alignItems: "center", height: 46 }}
            >
              {day ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    formatDate(value) + (has ? ", has events" : "")
                  }
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelected(value)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active
                      ? c.accent
                      : has
                        ? c.accentTint
                        : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: active ? "white" : c.text,
                      fontSize: 13,
                      fontWeight: has ? "700" : "400",
                    }}
                  >
                    {day}
                  </Text>
                  {has ? (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 4,
                        height: 3,
                        width: 3,
                        borderRadius: 2,
                        backgroundColor: active ? "white" : c.accent,
                      }}
                    />
                  ) : null}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      <Text
        style={{
          color: c.text,
          fontSize: 15,
          fontWeight: "700",
          backgroundColor: c.surface2,
          padding: 12,
          borderRadius: 12,
          marginTop: 26,
          marginBottom: 6,
        }}
      >
        {formatDate(selected)}
      </Text>
      <Feedback
        loading={loading}
        error={error}
        retry={() => setRetry((n) => n + 1)}
        empty={!loading && !error && !events.length}
        title="A little breathing room"
        message="No expirations or renewals on this date."
      />
      {!loading && !error
        ? events.map((event) => (
            <OccurrenceRow
              key={event.userItemId + event.occurrenceDate}
              event={event}
            />
          ))
        : null}
      {page && !loading && !error ? (
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 20 }}>
          {page.total} occurrences across {page.itemCount} items this month
        </Text>
      ) : null}
    </Screen>
  );
}
