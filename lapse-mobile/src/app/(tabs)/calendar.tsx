import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/typography";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Screen } from "@/components/ui";
import { MonthPicker } from "@/components/month-picker";
import { Feedback } from "@/components/feedback";
import { OccurrenceRow } from "@/components/occurrence-row";
import { usePreferences } from "@/context/preferences";
import { api } from "@/services/api";
import {
  dateInZone,
  dateOnly,
  formatDate,
  parseDate,
} from "@/utils/item-dates";
import type { TimelinePage } from "@/types/models";
export default function Calendar() {
  const { colors: c, timezone } = usePreferences();
  const [month, setMonth] = useState(() => {
    const date = parseDate(dateInZone(timezone)) ?? new Date();
    date.setDate(1);
    return date;
  });
  const [selected, setSelected] = useState(() => dateInZone(timezone));
  const [page, setPage] = useState<TimelinePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const { fontScale } = useWindowDimensions();
  const from = dateOnly(month);
  const to = dateOnly(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setPage(null);
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
  const move = useCallback(
    (amount: number) => {
      const next = new Date(month);
      next.setMonth(next.getMonth() + amount, 1);
      if (next.getFullYear() < 1 || next.getFullYear() > 9998) return;
      setMonth(next);
      setSelected(dateOnly(next));
    },
    [month],
  );
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 20 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_, gesture) => {
          if (
            Math.abs(gesture.dx) > 50 &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5
          )
            move(gesture.dx < 0 ? 1 : -1);
        },
      }),
    [move],
  );
  return (
    <Screen title="Calendar">
      <View
        {...swipe.panHandlers}
        style={
          Platform.OS === "web"
            ? ({
                touchAction: "pan-y",
                overscrollBehaviorX: "contain",
              } as ViewStyle)
            : undefined
        }
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 18,
            marginBottom: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose month and year"
            onPress={() => setShowPicker(true)}
            style={{ flex: 1, minHeight: 48, justifyContent: "center" }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: c.text }}>
              {month.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </Pressable>
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 2 }}>
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
                style={{
                  width: "14.285%",
                  alignItems: "center",
                  minHeight: Math.max(44, 32 * fontScale),
                }}
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
                      width: "100%",
                      minHeight: Math.max(44, 32 * fontScale),
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
      </View>
      {showPicker ? (
        <MonthPicker
          value={month}
          onClose={() => setShowPicker(false)}
          onChange={(date) => {
            setMonth(date);
            setSelected(dateOnly(date));
          }}
        />
      ) : null}
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
