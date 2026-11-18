import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { Text, TextInput } from "@/components/typography";
import { Check, ChevronRight, Plus, Search } from "lucide-react-native";
import { Button, Input, Screen } from "@/components/ui";
import { Feedback } from "@/components/feedback";
import { StorageImage } from "@/components/storage-image";
import {
  ExpiryFields,
  draftInput,
  type ExpiryDraft,
} from "@/components/expiry-fields";
import { useThemeColors } from "@/context/preferences";
import { api } from "@/services/api";
import type { Category, MasterItem } from "@/types/models";
import { parseDate } from "@/utils/item-dates";
const blank = (): ExpiryDraft => ({
  expiryType: "ONCE",
  expiryDate: "",
  interval: { years: 0, months: 0, days: 0 },
  renewalMode: "AUTOMATIC",
});
export default function AddFlow() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{ category?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [masters, setMasters] = useState<MasterItem[]>([]);
  const [master, setMaster] = useState<MasterItem | null>(null);
  const [custom, setCustom] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const initialCategory = useRef(false);
  const [created, setCreated] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    (category ? api.items(category.id) : api.categories())
      .then((result) => {
        if (!active) return;
        if (category) setMasters(result as MasterItem[]);
        else {
          setCategories(result as Category[]);
          if (params.category && !initialCategory.current) {
            initialCategory.current = true;
            const match = (result as Category[]).find(
              (row) => String(row.id) === params.category,
            );
            if (match) {
              setCategory(match);
              setStep(2);
            }
          }
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Unable to load catalog",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, retry, params.category]);
  const back = () => {
    if (lock.current) return;
    setError("");
    if (step === 3) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setLoading(true);
      setCategory(null);
      setCustom(false);
      setStep(1);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  });
  async function save() {
    if (lock.current) return;
    if (!category || (!master && !name.trim())) {
      setError("Enter an item name");
      return;
    }
    if (draft.expiryType !== "NEVER" && !parseDate(draft.expiryDate)) {
      setError("Choose a valid date");
      return;
    }
    if (
      draft.expiryType === "RECURRING" &&
      !Object.values(draft.interval).some((n) => n > 0)
    ) {
      setError("Choose a positive recurrence interval");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.createItem({
        ...draftInput(draft),
        ...(master
          ? { miId: master.id }
          : { mcId: category.id, itemName: name.trim() }),
      });
      setCreated(result.id);
      setStep(4);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save this item",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen
      title={
        step === 1
          ? "Add item"
          : step === 2
            ? category?.name
            : step === 3
              ? "New item"
              : " "
      }
      onBack={step < 4 ? back : undefined}
      footer={
        step === 3 ? (
          <Button
            title={busy ? "Creating…" : "Create item"}
            disabled={busy}
            onPress={() => void save()}
          />
        ) : undefined
      }
    >
      <Feedback
        loading={loading}
        error={step < 3 ? error : ""}
        retry={() => {
          setLoading(true);
          setError("");
          setRetry((n) => n + 1);
        }}
      />
      {step === 1 && !loading && !error ? (
        <>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: c.text,
              marginVertical: 14,
            }}
          >
            Choose a category
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {categories.map((row) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                onPress={() => {
                  setLoading(true);
                  setError("");
                  setCategory(row);
                  setStep(2);
                  setCustom(false);
                  setSearch("");
                  setMasters([]);
                }}
                style={({ pressed }) => ({
                  width: "48%",
                  flexGrow: 1,
                  minHeight: 86,
                  borderRadius: 17,
                  backgroundColor: c.accentTint,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 14,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <StorageImage uri={row.image_url} size={32} />
                <Text
                  style={{
                    color: c.text,
                    fontSize: 13,
                    fontWeight: "600",
                    flexShrink: 1,
                  }}
                >
                  {row.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Feedback
            empty={!categories.length}
            title="No categories available"
            message="Pull up this screen again after the catalog is available."
          />
        </>
      ) : null}
      {step === 2 && !loading && !error ? (
        <>
          {!custom ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: c.surface2,
                  borderRadius: 13,
                  paddingHorizontal: 12,
                  marginVertical: 16,
                }}
              >
                <Search size={17} color={c.muted} />
                <TextInput
                  accessibilityLabel="Search catalog"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search items…"
                  placeholderTextColor={c.muted}
                  style={{ flex: 1, minHeight: 48, color: c.text }}
                />
              </View>
              {masters
                .filter((row) =>
                  row.name.toLowerCase().includes(search.trim().toLowerCase()),
                )
                .map((row) => (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setMaster(row);
                      setName(row.name);
                      setDraft({
                        ...blank(),
                        expiryType: row.expiry_type ?? "ONCE",
                        expiryDate: row.expiry_date ?? "",
                        interval: {
                          years: row.recurrence_years ?? 0,
                          months: row.recurrence_months ?? 0,
                          days: row.recurrence_days ?? 0,
                        },
                        renewalMode: row.renewal_mode ?? "AUTOMATIC",
                      });
                      setStep(3);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      minHeight: 75,
                      borderBottomWidth: 0.5,
                      borderColor: c.border,
                    }}
                  >
                    <StorageImage
                      uri={row.image_url}
                      fallbackUri={
                        row.category_image_url ?? category?.image_url
                      }
                      size={42}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: c.text,
                        fontSize: 15,
                        fontWeight: "500",
                      }}
                    >
                      {row.name}
                    </Text>
                    <ChevronRight size={18} color={c.muted} />
                  </Pressable>
                ))}
              <Feedback
                empty={
                  !masters.filter((row) =>
                    row.name.toLowerCase().includes(search.toLowerCase()),
                  ).length
                }
                title="Create something personal"
                message="Add a custom item in this category."
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCustom(true);
                  setMaster(null);
                  setName("");
                  setDraft(blank());
                }}
                style={{
                  minHeight: 52,
                  borderRadius: 14,
                  backgroundColor: c.accentTint,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  marginTop: 20,
                }}
              >
                <Plus size={18} color={c.accentDark} />
                <Text style={{ color: c.accentDark, fontWeight: "600" }}>
                  Create custom item
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={{ marginTop: 24 }}>
              <StorageImage uri={category?.image_url} size={64} />
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "700",
                  color: c.text,
                  marginVertical: 20,
                }}
              >
                Your own {category?.name.toLowerCase()} item
              </Text>
              <Input
                label="Item name"
                value={name}
                onChangeText={setName}
                maxLength={100}
              />
              <Text
                style={{
                  color: c.muted,
                  fontSize: 13,
                  lineHeight: 21,
                  marginBottom: 20,
                }}
              >
                Your item automatically uses the {category?.name} category
                image.
              </Text>
              <Button
                title="Continue"
                disabled={!name.trim()}
                onPress={() => setStep(3)}
              />
            </View>
          )}
        </>
      ) : null}
      {step === 3 ? (
        <>
          <View
            style={{
              flexDirection: "row",
              gap: 14,
              alignItems: "center",
              marginVertical: 18,
            }}
          >
            <StorageImage
              uri={master?.image_url ?? category?.image_url}
              fallbackUri={category?.image_url}
              size={52}
            />
            <View>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
                {name}
              </Text>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 5 }}>
                {category?.name}
                {!master ? " · Custom item" : ""}
              </Text>
            </View>
          </View>
          <ExpiryFields value={draft} onChange={setDraft} />
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: c.danger, marginVertical: 16, lineHeight: 21 }}
            >
              {error}
            </Text>
          ) : null}
        </>
      ) : null}
      {step === 4 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 65,
          }}
        >
          <View
            style={{
              padding: 24,
              borderRadius: 48,
              backgroundColor: c.accentTint,
            }}
          >
            <Check color={c.accentDark} size={52} />
          </View>
          <Text
            style={{
              color: c.text,
              fontSize: 28,
              fontWeight: "700",
              marginTop: 26,
            }}
          >
            You’re all set.
          </Text>
          <Text
            style={{
              color: c.muted,
              fontSize: 15,
              textAlign: "center",
              lineHeight: 23,
              marginVertical: 16,
            }}
          >
            {name} is now in your items.
          </Text>
          <View style={{ alignSelf: "stretch", marginTop: 25 }}>
            <Button
              title="View item"
              onPress={() =>
                router.replace({
                  pathname: "/item/[id]",
                  params: { id: created! },
                })
              }
            />
            <Button
              title="Go to my items"
              variant="secondary"
              onPress={() => router.replace("/(tabs)/items")}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
