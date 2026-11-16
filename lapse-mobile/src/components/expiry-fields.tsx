import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Minus,
  Plus,
  X,
} from "lucide-react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { Button } from "@/components/ui";
import { usePreferences } from "@/context/preferences";
import {
  dateOnly,
  formatDate,
  intervalLabel,
  parseDate,
  type Interval,
} from "@/utils/item-dates";
import type { ExpiryType, ItemInput, RenewalMode } from "@/types/models";
import { api } from "@/services/api";
export type ExpiryDraft = {
  expiryType: ExpiryType;
  expiryDate: string;
  interval: Interval;
  renewalMode: RenewalMode;
};
export function draftInput(value: ExpiryDraft): ItemInput {
  return {
    expiryType: value.expiryType,
    ...(value.expiryType !== "NEVER" ? { expiryDate: value.expiryDate } : {}),
    ...(value.expiryType === "RECURRING"
      ? {
          recurrenceYears: value.interval.years,
          recurrenceMonths: value.interval.months,
          recurrenceDays: value.interval.days,
          renewalMode: value.renewalMode,
        }
      : {}),
  };
}
export function ExpiryFields({
  value,
  onChange,
}: {
  value: ExpiryDraft;
  onChange: (value: ExpiryDraft) => void;
}) {
  const { colors: c, dark, timezone } = usePreferences();
  const [picker, setPicker] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [interval, setInterval] = useState(value.interval);
  const [preview, setPreview] = useState("");
  const inputKey = JSON.stringify([value, timezone]);
  const [previewKey, setPreviewKey] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    if (
      value.expiryType === "NEVER" ||
      !parseDate(value.expiryDate) ||
      (value.expiryType === "RECURRING" &&
        !Object.values(value.interval).some((n) => n > 0))
    )
      return;
    const timer = setTimeout(() => {
      setPreviewKey(inputKey);
      setPreview("");
      setPending(true);
      api
        .preview(draftInput(value), timezone)
        .then((result) => {
          if (active)
            setPreview(
              result.effective_expiry_date
                ? `Next due ${formatDate(result.effective_expiry_date)}`
                : "",
            );
        })
        .catch(() => {})
        .finally(() => {
          if (active) setPending(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, timezone, inputKey]);
  const label = {
    color: c.text,
    fontSize: 13,
    fontWeight: "600" as const,
    marginTop: 18,
    marginBottom: 8,
  };
  return (
    <View>
      <Text style={label}>Expiration type</Text>
      <View
        style={{
          flexDirection: "row",
          padding: 4,
          backgroundColor: c.surface2,
          borderRadius: 14,
        }}
      >
        {(["ONCE", "RECURRING", "NEVER"] as const).map((type) => (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ checked: value.expiryType === type }}
            onPress={() => onChange({ ...value, expiryType: type })}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                value.expiryType === type ? c.accentTint : "transparent",
            }}
          >
            <Text
              style={{
                color: value.expiryType === type ? c.accentDark : c.muted,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {type === "ONCE"
                ? "Once"
                : type === "NEVER"
                  ? "None"
                  : "Recurring"}
            </Text>
          </Pressable>
        ))}
      </View>
      {value.expiryType !== "NEVER" ? (
        <>
          <Text style={label}>
            {value.expiryType === "RECURRING"
              ? "First due date"
              : "Expiration date"}
          </Text>
          {Platform.OS === "web" ? (
            <TextInput
              accessibilityLabel="Date (YYYY-MM-DD)"
              value={value.expiryDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.muted}
              onChangeText={(expiryDate) => onChange({ ...value, expiryDate })}
              style={{
                minHeight: 50,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 12,
                padding: 14,
                color: c.text,
              }}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose date"
              onPress={() => setPicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 50,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <CalendarDays color={c.muted} size={18} />
              <Text style={{ color: c.text }}>
                {formatDate(value.expiryDate) || "Choose date"}
              </Text>
            </Pressable>
          )}
          {picker && Platform.OS !== "web" ? (
            <DateTimePicker
              value={parseDate(value.expiryDate) ?? new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              themeVariant={dark ? "dark" : "light"}
              accentColor={c.accent}
              onDismiss={() => setPicker(false)}
              onValueChange={(_, date) => {
                onChange({ ...value, expiryDate: dateOnly(date) });
                setPicker(false);
              }}
            />
          ) : null}
        </>
      ) : null}
      {value.expiryType === "RECURRING" ? (
        <>
          <Text style={label}>Repeat every</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set recurrence"
            onPress={() => {
              setInterval({ ...value.interval });
              setRepeat(true);
            }}
            style={{
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 12,
              minHeight: 50,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: c.text, fontSize: 14 }}>
              {intervalLabel(value.interval) || "Choose years, months and days"}
            </Text>
            <ChevronDown size={18} color={c.muted} />
          </Pressable>
          <Text style={label}>Renewal method</Text>
          {(["AUTOMATIC", "MANUAL"] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: value.renewalMode === mode }}
              onPress={() => onChange({ ...value, renewalMode: mode })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                marginBottom: 8,
                minHeight: 65,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: value.renewalMode === mode ? c.accent : c.border,
                backgroundColor:
                  value.renewalMode === mode ? c.accentTint : c.surface,
              }}
            >
              <View style={{ flex: 1, gap: 5 }}>
                <Text
                  style={{ color: c.text, fontSize: 14, fontWeight: "600" }}
                >
                  {mode === "AUTOMATIC" ? "Automatic" : "Manual"}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>
                  {mode === "AUTOMATIC"
                    ? "Show the next scheduled date automatically."
                    : "Keep the due date until I confirm renewal."}
                </Text>
              </View>
              {value.renewalMode === mode ? (
                <Check size={18} color={c.accentDark} />
              ) : (
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 1,
                    borderColor: c.muted,
                  }}
                />
              )}
            </Pressable>
          ))}
        </>
      ) : null}
      {value.expiryType === "NEVER" ? (
        <View
          style={{
            backgroundColor: c.accentTint,
            borderRadius: 14,
            padding: 20,
            marginTop: 20,
          }}
        >
          <Text style={{ color: c.accentDark, lineHeight: 22 }}>
            This item has no expiration date. It stays in your items and won’t
            send expiration reminders.
          </Text>
        </View>
      ) : previewKey === inputKey && preview ? (
        <Text style={{ color: c.accentDark, fontSize: 13, marginTop: 16 }}>
          {preview}
        </Text>
      ) : previewKey === inputKey && pending ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 16 }} />
      ) : null}
      <Modal
        visible={repeat}
        transparent
        animationType="slide"
        onRequestClose={() => setRepeat(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,.35)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              paddingBottom: 42,
              width: "100%",
              maxWidth: 640,
              alignSelf: "center",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: c.text, fontSize: 22, fontWeight: "700" }}>
                Repeat every
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close recurrence"
                hitSlop={14}
                onPress={() => setRepeat(false)}
              >
                <X color={c.muted} size={22} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 16, marginVertical: 28 }}>
              {(["years", "months", "days"] as const).map((unit) => (
                <View
                  key={unit}
                  style={{ flex: 1, alignItems: "center", gap: 14 }}
                >
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    {unit[0].toUpperCase() + unit.slice(1)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${unit}`}
                    disabled={interval[unit] >= 999}
                    onPress={() =>
                      setInterval((old) => ({
                        ...old,
                        [unit]: Math.min(999, old[unit] + 1),
                      }))
                    }
                    style={{ padding: 12 }}
                  >
                    <Plus size={18} color={c.accentDark} />
                  </Pressable>
                  <TextInput
                    accessibilityLabel={unit}
                    keyboardType="number-pad"
                    value={String(interval[unit])}
                    onChangeText={(text) => {
                      if (/^\d{0,3}$/.test(text))
                        setInterval((old) => ({
                          ...old,
                          [unit]: Number(text),
                        }));
                    }}
                    style={{
                      textAlign: "center",
                      width: "100%",
                      fontSize: 26,
                      fontWeight: "600",
                      padding: 16,
                      borderRadius: 14,
                      backgroundColor: c.accentTint,
                      color: c.text,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${unit}`}
                    disabled={!interval[unit]}
                    onPress={() =>
                      setInterval((old) => ({
                        ...old,
                        [unit]: Math.max(0, old[unit] - 1),
                      }))
                    }
                    style={{ padding: 12 }}
                  >
                    <Minus color={c.muted} size={18} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text
              style={{
                color: c.muted,
                textAlign: "center",
                marginBottom: 18,
                fontSize: 13,
              }}
            >
              {intervalLabel(interval)
                ? `Every ${intervalLabel(interval)}`
                : "Choose at least one positive value"}
            </Text>
            <Button
              title="Apply"
              disabled={!Object.values(interval).some((n) => n > 0)}
              onPress={() => {
                onChange({ ...value, interval });
                setRepeat(false);
              }}
            />
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setRepeat(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
