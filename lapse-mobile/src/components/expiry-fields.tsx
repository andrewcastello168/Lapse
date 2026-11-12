import { usePreferences, useThemeColors } from "@/context/preferences";
import { useState } from "react";
import { CalendarDays, Info, Minus, Plus } from "lucide-react-native";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import type { Palette } from "@/constants/theme";
import type { ExpiryType } from "@/types/models";
import {
    dateOnly,
    daysUntil,
    formatDate,
    nextDueDate,
    parseDate,
    type Interval,
} from "@/utils/item-dates";

export type ExpiryDraft = {
    expiryType: ExpiryType;
    expiryDate: string;
    interval: Interval;
};
export function ExpiryFields({
    value,
    onChange,
}: {
    value: ExpiryDraft;
    onChange: (value: ExpiryDraft) => void;
}) {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const { dark } = usePreferences();
    const [picker, setPicker] = useState(false);
    const next =
        value.expiryType === "RECURRING"
            ? nextDueDate(value.expiryDate, value.interval)
            : null;
    const hint =
        value.expiryType === "NEVER"
            ? "This item will not have an expiry date and will always be shown in your items under “No Expiry”."
            : next
              ? `Based on your input, the next due date will be ${formatDate(next)}.`
              : value.expiryType === "ONCE" && parseDate(value.expiryDate)
                ? daysUntil(value.expiryDate) < 0
                    ? "This item has expired."
                    : `This item will expire in ${daysUntil(value.expiryDate).toLocaleString()} days.`
                : "";
    return (
        <View>
            <Text style={s.label}>Expiry type</Text>
            <View style={s.segments}>
                {(["ONCE", "RECURRING", "NEVER"] as const).map((type) => (
                    <Pressable
                        key={type}
                        accessibilityRole="radio"
                        accessibilityState={{
                            checked: value.expiryType === type,
                        }}
                        onPress={() => {
                            setPicker(false);
                            onChange({ ...value, expiryType: type });
                        }}
                        style={[
                            s.segment,
                            value.expiryType === type && s.active,
                        ]}
                    >
                        {value.expiryType === type ? (
                            <View style={s.radio}>
                                <View style={s.dot} />
                            </View>
                        ) : null}
                        <Text
                            style={[
                                s.segmentText,
                                value.expiryType === type && {
                                    color: colors.text,
                                },
                            ]}
                        >
                            {type === "NEVER"
                                ? "None"
                                : type === "ONCE"
                                  ? "Once"
                                  : "Recurring"}
                        </Text>
                    </Pressable>
                ))}
            </View>
            {value.expiryType === "RECURRING" ? (
                <>
                    <Text style={s.label}>Repeat every</Text>
                    <View style={s.counters}>
                        {(["years", "months", "days"] as const).map((unit) => (
                            <View key={unit} style={s.counterGroup}>
                                <Text style={s.unit}>
                                    {unit[0].toUpperCase() + unit.slice(1)}
                                </Text>
                                <View style={s.counter}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Decrease ${unit}`}
                                        disabled={!value.interval[unit]}
                                        onPress={() =>
                                            onChange({
                                                ...value,
                                                interval: {
                                                    ...value.interval,
                                                    [unit]:
                                                        value.interval[unit] -
                                                        1,
                                                },
                                            })
                                        }
                                        style={s.counterButton}
                                    >
                                        <Minus color={colors.muted} size={14} />
                                    </Pressable>
                                    <TextInput
                                        accessibilityLabel={unit}
                                        keyboardType="number-pad"
                                        style={s.number}
                                        value={String(value.interval[unit])}
                                        onChangeText={(text) => {
                                            if (/^\d{0,3}$/.test(text))
                                                onChange({
                                                    ...value,
                                                    interval: {
                                                        ...value.interval,
                                                        [unit]: Number(text),
                                                    },
                                                });
                                        }}
                                    />
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Increase ${unit}`}
                                        disabled={value.interval[unit] >= 999}
                                        onPress={() =>
                                            onChange({
                                                ...value,
                                                interval: {
                                                    ...value.interval,
                                                    [unit]:
                                                        value.interval[unit] +
                                                        1,
                                                },
                                            })
                                        }
                                        style={s.counterButton}
                                    >
                                        <Plus color={colors.accent} size={14} />
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>
                </>
            ) : null}
            {value.expiryType !== "NEVER" ? (
                <>
                    <Text style={s.label}>
                        {value.expiryType === "RECURRING"
                            ? "Start date (first due date)"
                            : "Expiry date"}
                    </Text>
                    {Platform.OS === "web" ? (
                        <View style={s.date}>
                            <TextInput
                                accessibilityLabel="Date (YYYY-MM-DD)"
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.muted}
                                style={s.dateText}
                                value={value.expiryDate}
                                onChangeText={(expiryDate) =>
                                    onChange({ ...value, expiryDate })
                                }
                            />
                            <CalendarDays color={colors.muted} size={18} />
                        </View>
                    ) : (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Choose date"
                            style={s.date}
                            onPress={() => setPicker(!picker)}
                        >
                            <CalendarDays color={colors.muted} size={18} />
                            <Text style={s.dateText}>
                                {formatDate(value.expiryDate) || "Choose date"}
                            </Text>
                            <CalendarDays color={colors.muted} size={18} />
                        </Pressable>
                    )}
                    {picker && Platform.OS !== "web" ? (
                        <DateTimePicker
                            value={parseDate(value.expiryDate) ?? new Date()}
                            mode="date"
                            display={
                                Platform.OS === "ios" ? "inline" : "default"
                            }
                            themeVariant={dark ? "dark" : "light"}
                            accentColor={colors.accent}
                            onDismiss={() => setPicker(false)}
                            onValueChange={(_, date) => {
                                onChange({
                                    ...value,
                                    expiryDate: dateOnly(date),
                                });
                                setPicker(false);
                            }}
                        />
                    ) : null}
                </>
            ) : null}
            {hint ? (
                <View style={s.hint}>
                    <Info size={18} color={colors.muted} />
                    <Text style={s.hintText}>{hint}</Text>
                </View>
            ) : null}
        </View>
    );
}
const createStyles = (colors: Palette) =>
    StyleSheet.create({
        label: {
            color: colors.text,
            fontSize: 14,
            fontWeight: "600",
            marginBottom: 8,
        },
        segments: { flexDirection: "row", gap: 6, marginBottom: 18 },
        segment: {
            flex: 1,
            minHeight: 44,
            flexDirection: "row",
            gap: 6,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
        },
        active: {
            backgroundColor: colors.accentTint,
            borderColor: colors.accentDark,
        },
        segmentText: { color: colors.muted, fontSize: 12 },
        radio: {
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.accent,
            justifyContent: "center",
            alignItems: "center",
        },
        dot: {
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: colors.accentDark,
        },
        counters: { flexDirection: "row", gap: 12, marginBottom: 18 },
        counterGroup: { flex: 1 },
        unit: {
            color: colors.muted,
            fontSize: 12,
            textAlign: "center",
            marginBottom: 6,
        },
        counter: {
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 8,
            backgroundColor: colors.surface,
        },
        counterButton: {
            flex: 1,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
        },
        number: {
            width: 28,
            color: colors.text,
            textAlign: "center",
            padding: 0,
            fontSize: 15,
        },
        date: {
            minHeight: 48,
            paddingHorizontal: 12,
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: colors.surface,
            marginBottom: 12,
        },
        dateText: {
            flex: 1,
            color: colors.text,
            fontSize: 14,
            paddingVertical: 10,
        },
        hint: {
            flexDirection: "row",
            gap: 8,
            backgroundColor: colors.surface2,
            padding: 12,
            borderRadius: 8,
        },
        hintText: {
            flex: 1,
            color: colors.muted,
            fontSize: 12,
            lineHeight: 18,
        },
    });
