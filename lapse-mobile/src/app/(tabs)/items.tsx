import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/components/typography";
import { Search } from "lucide-react-native";
import { Screen } from "@/components/ui";
import { Feedback } from "@/components/feedback";
import { ItemRow } from "@/components/item-row";
import { useTrackedItems } from "@/hooks/use-tracked-items";
import { useThemeColors } from "@/context/preferences";
import { api } from "@/services/api";
import type { Category } from "@/types/models";
const filters = [
  "All",
  "Overdue",
  "Due soon",
  "Upcoming",
  "No expiry",
] as const;
export default function Items() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{ category?: string }>();
  const { items, loading, error, reload } = useTrackedItems();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const category = params.category ?? "All";
  const setCategory = (value: string) => router.setParams({ category: value });
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api
      .categories()
      .then(setCategories)
      .catch(() => {});
  }, []);
  const data = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.item_name
              .toLowerCase()
              .includes(search.trim().toLowerCase()) &&
            (category === "All" || String(item.mc_id) === category) &&
            (filter === "All" ||
              (filter === "Overdue"
                ? item.expiration_status === "OVERDUE"
                : filter === "Due soon"
                  ? ["DUE_TODAY", "EXPIRING_SOON"].includes(
                      item.expiration_status,
                    )
                  : filter === "No expiry"
                    ? item.expiry_type === "NEVER"
                    : item.expiration_status === "UPCOMING")),
        )
        .sort((a, b) =>
          (a.effective_expiry_date ?? "9999").localeCompare(
            b.effective_expiry_date ?? "9999",
          ),
        ),
    [items, search, category, filter],
  );
  return (
    <Screen title="My items" scroll={false}>
      <FlatList
        data={loading || error ? [] : data}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        contentContainerStyle={{
          padding: 22,
          paddingTop: 10,
          maxWidth: 640,
          width: "100%",
          alignSelf: "center",
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            onPress={() =>
              router.push({ pathname: "/item/[id]", params: { id: item.id } })
            }
          />
        )}
        ListHeaderComponent={
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: c.surface2,
                borderRadius: 14,
                paddingHorizontal: 14,
                marginBottom: 14,
              }}
            >
              <Search size={17} color={c.muted} />
              <TextInput
                accessibilityLabel="Search items"
                placeholder="Search items…"
                placeholderTextColor={c.muted}
                value={search}
                onChangeText={setSearch}
                style={{ color: c.text, flex: 1, minHeight: 48, fontSize: 14 }}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, paddingBottom: 14 }}
            >
              {filters.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === option }}
                  onPress={() => setFilter(option)}
                  style={{
                    backgroundColor: filter === option ? c.accent : c.surface2,
                    paddingHorizontal: 14,
                    minHeight: 38,
                    borderRadius: 20,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: filter === option ? "white" : c.muted,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
            >
              {[{ id: "All", name: "All categories" }, ...categories].map(
                (entry) => (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="button"
                    onPress={() => setCategory(String(entry.id))}
                    style={{
                      borderBottomWidth: category === String(entry.id) ? 2 : 0,
                      borderColor: c.accent,
                      padding: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color:
                          category === String(entry.id)
                            ? c.accentDark
                            : c.muted,
                      }}
                    >
                      {entry.name}
                    </Text>
                  </Pressable>
                ),
              )}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          <Feedback
            loading={loading}
            error={error}
            retry={reload}
            empty={!loading && !error}
            title={
              search || filter !== "All" || category !== "All"
                ? "No matching items"
                : "Your dates, all in one place"
            }
            message={
              search || filter !== "All" || category !== "All"
                ? "Try a different search or filter."
                : "Use the + button to track your first item."
            }
          />
        }
      />
    </Screen>
  );
}
