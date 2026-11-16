import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { Button, Input, Screen } from "@/components/ui";
import { StorageImage } from "@/components/storage-image";
import { Feedback } from "@/components/feedback";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { CalendarInput } from "@/components/calendar-input";
import {
  ExpiryFields,
  draftInput,
  type ExpiryDraft,
} from "@/components/expiry-fields";
import { usePreferences } from "@/context/preferences";
import { api, ApiError } from "@/services/api";
import type { Category, UserItem } from "@/types/models";
import { formatDate, intervalLabel, parseDate } from "@/utils/item-dates";
const draftOf = (item: UserItem): ExpiryDraft => ({
  expiryType: item.expiry_type,
  expiryDate: item.expiry_date ?? "",
  interval: {
    years: item.recurrence_years ?? 0,
    months: item.recurrence_months ?? 0,
    days: item.recurrence_days ?? 0,
  },
  renewalMode: item.renewal_mode ?? "AUTOMATIC",
});
export default function ItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Details key={id} id={id} />;
}
function Details({ id }: { id: string }) {
  const { colors: c, timezone } = usePreferences();
  const [item, setItem] = useState<UserItem | null>(null);
  const [draft, setDraft] = useState<ExpiryDraft>({
    expiryType: "ONCE",
    expiryDate: "",
    interval: { years: 0, months: 0, days: 0 },
    renewalMode: "AUTOMATIC",
  });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<"delete" | "reset" | "renew" | null>(null);
  const [newDate, setNewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const fill = (value: UserItem) => {
    setItem(value);
    setDraft(draftOf(value));
    setName(value.item_name);
    setCategory(String(value.mc_id));
  };
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      api
        .userItem(id, timezone)
        .then((value) => {
          if (active) fill(value);
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error ? reason.message : "Unable to load item",
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
    }, [id, timezone, retry]),
  );
  useEffect(() => {
    if (editing && !item?.mi_id)
      api
        .categories()
        .then(setCategories)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load categories",
          ),
        );
  }, [editing, item?.mi_id]);
  const back = () => {
    if (lock.current) return;
    if (editing && item) {
      fill(item);
      setEditing(false);
      setError("");
    } else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/items");
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  });
  async function save(reset = false) {
    if (lock.current || !item) return;
    setError("");
    if (draft.expiryType !== "NEVER" && !parseDate(draft.expiryDate)) {
      setError("Choose a valid calendar date");
      return;
    }
    if (
      draft.expiryType === "RECURRING" &&
      !Object.values(draft.interval).some((n) => n > 0)
    ) {
      setError("Choose a positive recurrence interval");
      return;
    }
    if (!item.mi_id && !name.trim()) {
      setError("Enter an item name");
      return;
    }
    const original = draftOf(item);
    const material =
      draft.expiryType !== original.expiryType ||
      (draft.expiryType !== "NEVER" &&
        draft.expiryDate !== original.expiryDate) ||
      (draft.expiryType === "RECURRING" &&
        (JSON.stringify(draft.interval) !== JSON.stringify(original.interval) ||
          draft.renewalMode !== original.renewalMode));
    if (item.renewed_through && material && !reset) {
      setSheet("reset");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const updated = await api.updateItem(id, {
        ...draftInput(draft),
        ...(!item.mi_id ? { itemName: name.trim(), mcId: category } : {}),
        ...(reset
          ? {
              resetConfirmation: true,
              expectedRenewedThrough: item.renewed_through!,
            }
          : {}),
      });
      fill(updated);
      setEditing(false);
      setSheet(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save changes",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (lock.current || !item) return;
    if (sheet === "reset") {
      await save(true);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (sheet === "delete") {
        await api.deleteItem(id);
        setSheet(null);
        router.replace("/(tabs)/items");
      } else if (sheet === "renew") {
        const updated = await api.renew(
          id,
          item.effective_expiry_date!,
          newDate,
        );
        fill(updated);
        setSheet(null);
      }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          fill(await api.userItem(id, timezone));
        } catch {
          /* The user can retry loading the item. */
        }
      }
      setError(reason instanceof Error ? reason.message : "Please try again");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const image =
    editing && !item?.mi_id
      ? (categories.find((row) => String(row.id) === category)?.image_url ??
        item?.category_image_url)
      : item?.image_url;
  const due = item?.days_remaining;
  const overdue = due !== null && due !== undefined && due < 0;
  return (
    <Screen
      title={editing ? "Edit item" : " "}
      onBack={back}
      trailing={
        item ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete item"
            onPress={() => {
              setError("");
              setSheet("delete");
            }}
            style={{ padding: 12 }}
          >
            <Trash2 size={20} color={c.danger} />
          </Pressable>
        ) : undefined
      }
      footer={
        item ? (
          editing ? (
            <Button
              title={busy ? "Saving…" : "Save changes"}
              disabled={busy}
              onPress={() => void save()}
            />
          ) : (
            <View>
              {item.can_renew ? (
                <Button
                  title={
                    item.expiry_type === "ONCE"
                      ? "Renew item"
                      : "Mark as renewed"
                  }
                  onPress={() => {
                    setError("");
                    setNewDate(
                      item.expiry_type === "RECURRING"
                        ? (item.next_scheduled_date ?? "")
                        : "",
                    );
                    setSheet("renew");
                  }}
                />
              ) : null}
              <Button
                title="Edit item"
                variant="secondary"
                onPress={() => {
                  setError("");
                  setEditing(true);
                }}
              />
            </View>
          )
        ) : undefined
      }
    >
      <Feedback
        loading={loading}
        error={!sheet ? error : ""}
        retry={() => setRetry((n) => n + 1)}
      />
      {item && !loading ? (
        <>
          <View
            style={{ alignItems: "center", marginTop: 18, marginBottom: 28 }}
          >
            <StorageImage
              uri={image}
              fallbackUri={item.category_image_url}
              size={80}
            />
            <Text
              style={{
                color: c.text,
                fontSize: 26,
                fontWeight: "700",
                letterSpacing: -0.7,
                textAlign: "center",
                marginTop: 18,
              }}
            >
              {item.item_name}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, marginTop: 7 }}>
              {item.category_name}
            </Text>
            {!editing ? (
              <View
                style={{
                  backgroundColor: c.accentTint,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  marginTop: 16,
                }}
              >
                <Text
                  style={{
                    color: c.accentDark,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {item.expiry_type === "NEVER"
                    ? "No expiration"
                    : item.expiry_type === "ONCE"
                      ? "One-time expiration"
                      : item.renewal_mode === "MANUAL"
                        ? "Manual renewal"
                        : "Automatic schedule"}
                </Text>
              </View>
            ) : null}
          </View>
          {editing ? (
            <>
              {!item.mi_id ? (
                <>
                  <Input
                    label="Item name"
                    value={name}
                    onChangeText={setName}
                    maxLength={100}
                  />
                  <Text
                    style={{
                      color: c.text,
                      fontSize: 13,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    Category
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
                  >
                    {categories.map((row) => (
                      <Pressable
                        key={row.id}
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: category === String(row.id),
                        }}
                        onPress={() => setCategory(String(row.id))}
                        style={{
                          borderWidth: 1,
                          borderColor:
                            category === String(row.id) ? c.accent : c.border,
                          backgroundColor:
                            category === String(row.id)
                              ? c.accentTint
                              : c.surface,
                          padding: 12,
                          borderRadius: 14,
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <StorageImage uri={row.image_url} size={30} />
                        <Text style={{ color: c.text, fontSize: 12 }}>
                          {row.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}
              <ExpiryFields value={draft} onChange={setDraft} />
            </>
          ) : (
            <>
              <View
                style={{
                  borderRadius: 20,
                  backgroundColor: overdue ? c.surface2 : c.accentTint,
                  padding: 22,
                  marginBottom: 24,
                }}
              >
                <Text
                  style={{
                    color: overdue ? c.danger : c.accentDark,
                    fontSize: 13,
                    marginBottom: 9,
                  }}
                >
                  {item.expiry_type === "NEVER"
                    ? "No expiration date"
                    : item.renewal_mode === "MANUAL"
                      ? "Confirmed valid through"
                      : item.expiry_type === "ONCE"
                        ? "Expiration date"
                        : "Next scheduled renewal"}
                </Text>
                <Text
                  style={{
                    fontSize: item.expiry_type === "NEVER" ? 40 : 30,
                    fontWeight: "700",
                    color: overdue ? c.danger : c.text,
                    letterSpacing: -1,
                  }}
                >
                  {item.expiry_type === "NEVER"
                    ? "∞"
                    : formatDate(item.effective_expiry_date)}
                </Text>
                <Text
                  style={{
                    color: overdue ? c.danger : c.accentDark,
                    fontSize: 14,
                    marginTop: 7,
                    lineHeight: 21,
                  }}
                >
                  {due === null
                    ? "This item doesn’t have an expiration date."
                    : due === 0
                      ? "Due today"
                      : due! < 0
                        ? Math.abs(due!) + " days overdue"
                        : "In " + due + " days"}
                </Text>
              </View>
              {item.expiry_type === "RECURRING" ? (
                <>
                  <Detail
                    label="Repeat every"
                    value={intervalLabel({
                      years: item.recurrence_years ?? 0,
                      months: item.recurrence_months ?? 0,
                      days: item.recurrence_days ?? 0,
                    })}
                  />
                  <Detail
                    label="Original first due date"
                    value={formatDate(item.expiry_date)}
                  />
                  <Detail
                    label="Renewal method"
                    value={
                      item.renewal_mode === "MANUAL" ? "Manual" : "Automatic"
                    }
                  />
                  {item.renewal_mode === "MANUAL" ? (
                    <Detail
                      label="Next scheduled date"
                      value={formatDate(item.next_scheduled_date)}
                    />
                  ) : (
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 12,
                        lineHeight: 20,
                        marginTop: 12,
                      }}
                    >
                      Dates follow your schedule. Lapse does not verify payments
                      or external renewals.
                    </Text>
                  )}
                </>
              ) : (
                <Detail
                  label="Expiration type"
                  value={item.expiry_type === "ONCE" ? "Once" : "None"}
                />
              )}
            </>
          )}
        </>
      ) : null}
      <ConfirmSheet
        visible={sheet !== null}
        title={
          sheet === "delete"
            ? "Delete this item?"
            : sheet === "reset"
              ? "Reset renewal confirmation?"
              : "Confirm renewal"
        }
        confirm={
          sheet === "delete"
            ? "Delete item"
            : sheet === "reset"
              ? "Reset and save"
              : "Confirm renewal"
        }
        danger={sheet === "delete"}
        busy={busy}
        error={error}
        disabled={
          sheet === "renew" &&
          (!parseDate(newDate) ||
            !item?.effective_expiry_date ||
            newDate <= item.effective_expiry_date)
        }
        onCancel={() => {
          setSheet(null);
          setError("");
        }}
        onConfirm={() => void confirm()}
      >
        {sheet === "delete" ? (
          <Text style={{ color: c.muted, lineHeight: 22, marginBottom: 24 }}>
            Delete {item?.item_name} and cancel its scheduled reminders on this
            device? This cannot be undone.
          </Text>
        ) : sheet === "reset" ? (
          <Text style={{ color: c.muted, lineHeight: 22, marginBottom: 24 }}>
            Changing this schedule will clear the confirmation through{" "}
            {formatDate(item?.renewed_through)}. The new schedule will use its
            first due date until renewed again.
          </Text>
        ) : (
          <>
            <Text style={{ color: c.muted, lineHeight: 22, marginBottom: 16 }}>
              Current expiration: {formatDate(item?.effective_expiry_date)}
              {"\n"}New expiration: {formatDate(newDate) || "Choose a date"}
              {"\n\n"}Enter the actual new validity date. Covering a past period
              can leave the item overdue.
            </Text>
            <CalendarInput
              label="New validity date"
              value={newDate}
              onChange={setNewDate}
            />
          </>
        )}
      </ConfirmSheet>
    </Screen>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  const { colors: c } = usePreferences();
  return (
    <View
      style={{
        paddingVertical: 15,
        borderBottomWidth: 0.5,
        borderColor: c.border,
        gap: 7,
      }}
    >
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "500" }}>
        {value}
      </Text>
    </View>
  );
}
