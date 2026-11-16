import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { CalendarCheck, RefreshCw } from "lucide-react-native";
import { useThemeColors } from "@/context/preferences";
export function Feedback({
  loading,
  error,
  empty,
  title = "Nothing here yet",
  message = "Add an item to start tracking your important dates.",
  retry,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  title?: string;
  message?: string;
  retry?: () => void;
}) {
  const c = useThemeColors();
  if (loading)
    return (
      <ActivityIndicator
        accessibilityLabel="Loading"
        color={c.accent}
        style={{ padding: 36 }}
      />
    );
  if (error)
    return (
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={{
          padding: 20,
          borderRadius: 16,
          backgroundColor: c.surface2,
          marginVertical: 20,
          alignItems: "center",
          gap: 10,
        }}
      >
        <RefreshCw size={22} color={c.danger} />
        <Text
          accessibilityRole="alert"
          style={{ color: c.danger, textAlign: "center", lineHeight: 21 }}
        >
          {error}
        </Text>
        <Text style={{ color: c.accentDark, fontWeight: "600" }}>
          Tap to retry
        </Text>
      </Pressable>
    );
  if (empty)
    return (
      <View
        style={{
          alignItems: "center",
          paddingVertical: 38,
          paddingHorizontal: 16,
          gap: 12,
        }}
      >
        <View
          style={{
            backgroundColor: c.accentTint,
            padding: 18,
            borderRadius: 24,
          }}
        >
          <CalendarCheck color={c.accentDark} size={32} />
        </View>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
          {title}
        </Text>
        <Text
          style={{
            color: c.muted,
            fontSize: 14,
            textAlign: "center",
            lineHeight: 22,
            maxWidth: 270,
          }}
        >
          {message}
        </Text>
      </View>
    );
  return null;
}
