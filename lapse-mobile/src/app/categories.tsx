import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/typography";
import { Screen } from "@/components/ui";
import { Feedback } from "@/components/feedback";
import { StorageImage } from "@/components/storage-image";
import { useThemeColors } from "@/context/preferences";
import { api } from "@/services/api";
import type { Category } from "@/types/models";
export default function Categories() {
  const c = useThemeColors();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      api
        .categories()
        .then((data) => {
          if (active) {
            setRows(data);
            setError("");
          }
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to load categories",
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
    }, [retry]),
  );
  return (
    <Screen
      title="Categories"
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/(tabs)")
      }
    >
      <Feedback
        loading={loading}
        error={error}
        empty={!loading && !error && !rows.length}
        retry={() => setRetry((n) => n + 1)}
      />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 20,
        }}
      >
        {!loading && !error
          ? rows.map((row) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/items",
                    params: { category: String(row.id) },
                  })
                }
                style={{
                  flexBasis: "45%",
                  flexGrow: 1,
                  padding: 18,
                  minHeight: 90,
                  borderRadius: 18,
                  backgroundColor: c.accentTint,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <StorageImage uri={row.image_url} size={34} />
                <Text
                  style={{
                    color: c.text,
                    fontSize: 14,
                    fontWeight: "600",
                    flexShrink: 1,
                  }}
                >
                  {row.name}
                </Text>
              </Pressable>
            ))
          : null}
      </View>
    </Screen>
  );
}
