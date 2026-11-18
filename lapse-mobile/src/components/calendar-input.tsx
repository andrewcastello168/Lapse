import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Text, TextInput } from "@/components/typography";
import { CalendarDays } from "lucide-react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { usePreferences } from "@/context/preferences";
import { dateOnly, formatDate, parseDate } from "@/utils/item-dates";
export function CalendarInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const { colors: c, dark } = usePreferences();
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        style={{
          color: c.text,
          fontSize: 13,
          fontWeight: "600",
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {Platform.OS === "web" ? (
        <TextInput
          accessibilityLabel={label}
          value={value}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.muted}
          onChangeText={onChange}
          style={{
            color: c.text,
            minHeight: 50,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 12,
            padding: 14,
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setShow(true)}
          style={{
            flexDirection: "row",
            gap: 10,
            minHeight: 50,
            alignItems: "center",
            padding: 14,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 12,
          }}
        >
          <CalendarDays color={c.muted} size={18} />
          <Text style={{ color: c.text }}>
            {formatDate(value) || "Choose date"}
          </Text>
        </Pressable>
      )}
      {show && Platform.OS !== "web" ? (
        <DateTimePicker
          value={parseDate(value) ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          themeVariant={dark ? "dark" : "light"}
          onDismiss={() => setShow(false)}
          onValueChange={(_, date) => {
            onChange(dateOnly(date));
            setShow(false);
          }}
        />
      ) : null}
    </View>
  );
}
