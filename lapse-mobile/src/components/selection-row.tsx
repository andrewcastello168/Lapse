import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "./typography";
import { useThemeColors } from "@/context/preferences";

export const offsetLabel = (n: number) =>
  n === 0 ? "On the due date" : `${n} ${n === 1 ? "day" : "days"} before`;

export function SelectionRow({
  label,
  description,
  selected,
  disabled,
  multiple,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  multiple?: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        gap: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: selected ? c.accentDark : c.border,
        borderRadius: 12,
        marginTop: 8,
        backgroundColor: selected ? c.accentTint : c.surface,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: multiple ? 5 : 11,
          borderWidth: 1.5,
          borderColor: selected ? c.accentDark : c.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <Check size={15} color={c.accentDark} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: "500" }}>
          {label}
        </Text>
        {description ? (
          <Text
            style={{
              color: c.muted,
              fontSize: 12,
              lineHeight: 18,
              marginTop: 4,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
