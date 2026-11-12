import { CategoryIcon } from "@/components/category-icon";
import { useThemeColors } from "@/context/preferences";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    BackHandler,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Trash2 } from "lucide-react-native";
import { Button, Card, Screen } from "@/components/ui";
import { StorageImage } from "@/components/storage-image";
import { DueBadge, itemDueDate } from "@/components/item-row";
import { ExpiryFields, type ExpiryDraft } from "@/components/expiry-fields";
import type { Palette } from "@/constants/theme";
import { api } from "@/services/api";
import type { UserItem } from "@/types/models";
import { formatDate, parseDate } from "@/utils/item-dates";

export default function ItemDetailsRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <ItemDetails key={id} id={id} />;
}
function ItemDetails({ id }: { id: string }) {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const [item, setItem] = useState<UserItem | null>(null);
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const [draft, setDraft] = useState<ExpiryDraft>({
        expiryType: "ONCE",
        expiryDate: "",
        interval: { years: 0, months: 0, days: 0 },
    });
    const fillDraft = (value: UserItem) =>
        setDraft({
            expiryType: value.expiry_type,
            expiryDate: value.expiry_date?.slice(0, 10) ?? "",
            interval: {
                years: value.recurrence_years ?? 0,
                months: value.recurrence_months ?? 0,
                days: value.recurrence_days ?? 0,
            },
        });
    useEffect(() => {
        let active = true;
        api.userItem(id)
            .then((value) => {
                if (active) {
                    setItem(value);
                    fillDraft(value);
                }
            })
            .catch((reason: unknown) => {
                if (active)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Unable to load this item.",
                    );
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [id, retry]);
    const back = () => {
        if (busyRef.current) return;
        if (editing && item) {
            fillDraft(item);
            setEditing(false);
            setError("");
        } else if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/items");
    };
    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                back();
                return true;
            },
        );
        return () => subscription.remove();
    });
    const save = async () => {
        if (busyRef.current) return;
        if (draft.expiryType !== "NEVER" && !parseDate(draft.expiryDate)) {
            setError("Choose a valid date.");
            return;
        }
        if (
            draft.expiryType === "RECURRING" &&
            !Object.values(draft.interval).some((v) => v > 0)
        ) {
            setError("Enter at least one positive recurrence interval.");
            return;
        }
        busyRef.current = true;
        setBusy(true);
        setError("");
        try {
            const updated = await api.updateItem(id, {
                expiryType: draft.expiryType,
                ...(draft.expiryType !== "NEVER"
                    ? { expiryDate: draft.expiryDate }
                    : {}),
                ...(draft.expiryType === "RECURRING"
                    ? {
                          ...(draft.interval.years
                              ? { recurrenceYears: draft.interval.years }
                              : {}),
                          ...(draft.interval.months
                              ? { recurrenceMonths: draft.interval.months }
                              : {}),
                          ...(draft.interval.days
                              ? { recurrenceDays: draft.interval.days }
                              : {}),
                      }
                    : {}),
            });
            setItem(updated);
            fillDraft(updated);
            setEditing(false);
        } catch (reason: unknown) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : "Unable to save changes.",
            );
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    };
    const remove = async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setError("");
        try {
            await api.deleteItem(id);
            setDeleting(false);
            router.replace("/(tabs)/items");
        } catch (reason: unknown) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : "Unable to delete this item.",
            );
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    };
    const due = item ? itemDueDate(item) : null;
    return (
        <Screen
            title={editing ? "Edit Item" : " "}
            onBack={back}
            trailing={
                item ? (
                    editing ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Delete item"
                            onPress={() => setDeleting(true)}
                            style={s.iconButton}
                        >
                            <Trash2 size={21} color={colors.danger} />
                        </Pressable>
                    ) : (
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => setEditing(true)}
                            style={s.edit}
                        >
                            <Text style={s.editText}>Edit</Text>
                        </Pressable>
                    )
                ) : null
            }
            footer={
                editing ? (
                    <Button
                        title={busy ? "Saving..." : "Save changes"}
                        disabled={busy}
                        onPress={save}
                    />
                ) : undefined
            }
        >
            {loading ? <ActivityIndicator color={colors.accent} /> : null}
            {item ? (
                editing ? (
                    <>
                        <Card style={s.identity}>
                            <>
                                {item.mi_id ? (
                                    <StorageImage
                                        path={item.image_path}
                                        size={46}
                                    />
                                ) : (
                                    <CategoryIcon
                                        name={item.category_name}
                                        path={
                                            item.category_image_path ??
                                            item.image_path
                                        }
                                        size={46}
                                    />
                                )}
                            </>
                            <View style={s.main}>
                                <Text style={s.name}>{item.item_name}</Text>
                                <Text style={s.meta}>
                                    {item.category_name}
                                    {!item.mi_id ? " · Custom" : ""}
                                </Text>
                            </View>
                        </Card>
                        <ExpiryFields value={draft} onChange={setDraft} />
                    </>
                ) : (
                    <>
                        <View style={s.hero}>
                            <>
                                {item.mi_id ? (
                                    <StorageImage
                                        path={item.image_path}
                                        size={80}
                                    />
                                ) : (
                                    <CategoryIcon
                                        name={item.category_name}
                                        path={
                                            item.category_image_path ??
                                            item.image_path
                                        }
                                        size={80}
                                    />
                                )}
                            </>
                            <Text style={s.heroName}>{item.item_name}</Text>
                            <Text style={s.meta}>
                                {item.category_name}
                                {!item.mi_id ? " · Custom" : ""}
                            </Text>
                        </View>
                        <Card>
                            <View style={s.due}>
                                <View>
                                    <Text style={s.meta}>
                                        {due ? "Next due date" : "Expiry type"}
                                    </Text>
                                    <Text style={s.name}>
                                        {due ? formatDate(due) : "No expiry"}
                                    </Text>
                                </View>
                                <DueBadge date={due} />
                            </View>
                            {item.expiry_type === "RECURRING" ? (
                                <View style={s.repeat}>
                                    <View style={s.main}>
                                        <Text style={s.meta}>Repeat every</Text>
                                        <Text style={s.name}>
                                            {[
                                                [item.recurrence_years, "year"],
                                                [
                                                    item.recurrence_months,
                                                    "month",
                                                ],
                                                [item.recurrence_days, "day"],
                                            ]
                                                .filter(([v]) => Number(v) > 0)
                                                .map(
                                                    ([v, unit]) =>
                                                        `${v} ${unit}${Number(v) === 1 ? "" : "s"}`,
                                                )
                                                .join(", ")}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={s.meta}>Start date</Text>
                                        <Text style={s.name}>
                                            {formatDate(item.expiry_date)}
                                        </Text>
                                    </View>
                                </View>
                            ) : null}
                            <Text style={s.categoryLabel}>Category</Text>
                            <View style={s.identity}>
                                <CategoryIcon
                                    name={item.category_name}
                                    path={item.category_image_path}
                                    size={40}
                                />
                                <Text style={s.name}>{item.category_name}</Text>
                            </View>
                        </Card>
                    </>
                )
            ) : null}
            {error && !deleting ? (
                <Pressable
                    onPress={() => {
                        if (!item) {
                            setLoading(true);
                            setError("");
                            setRetry((n) => n + 1);
                        }
                    }}
                >
                    <Text selectable accessibilityRole="alert" style={s.error}>
                        {error}
                        {!item ? " Tap to retry." : ""}
                    </Text>
                </Pressable>
            ) : null}
            <Modal
                visible={deleting}
                transparent
                animationType="none"
                onRequestClose={() => {
                    if (!busy) setDeleting(false);
                }}
            >
                <View style={s.overlay}>
                    <Card style={s.dialog}>
                        <View style={s.trash}>
                            <Trash2 color={colors.danger} size={34} />
                        </View>
                        <Text style={s.dialogTitle}>Delete this item?</Text>
                        <Text style={s.dialogText}>
                            This action cannot be undone.
                        </Text>
                        {error ? (
                            <Text selectable style={s.error}>
                                {error}
                            </Text>
                        ) : null}
                        <View style={s.dialogActions}>
                            <View style={s.main}>
                                <Button
                                    title="Cancel"
                                    variant="secondary"
                                    disabled={busy}
                                    onPress={() => setDeleting(false)}
                                />
                            </View>
                            <View style={s.main}>
                                <Button
                                    title={busy ? "Deleting..." : "Delete"}
                                    variant="danger"
                                    disabled={busy}
                                    onPress={remove}
                                />
                            </View>
                        </View>
                    </Card>
                </View>
            </Modal>
        </Screen>
    );
}
const createStyles = (colors: Palette) =>
    StyleSheet.create({
        main: { flex: 1 },
        iconButton: {
            minWidth: 44,
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
        },
        edit: { padding: 10, borderRadius: 6, backgroundColor: colors.surface },
        editText: { color: colors.accent, fontSize: 13 },
        identity: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
        },
        name: {
            color: colors.text,
            fontSize: 15,
            fontWeight: "600",
            marginTop: 4,
        },
        meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
        hero: { alignItems: "center", marginBottom: 24 },
        heroName: {
            color: colors.text,
            fontSize: 24,
            fontWeight: "700",
            marginTop: 12,
        },
        due: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderColor: colors.border,
        },
        repeat: {
            flexDirection: "row",
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: colors.border,
        },
        categoryLabel: {
            color: colors.muted,
            fontSize: 12,
            marginVertical: 14,
        },
        error: {
            color: colors.danger,
            fontSize: 13,
            marginVertical: 12,
            lineHeight: 20,
        },
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.72)",
            justifyContent: "center",
            padding: 24,
        },
        dialog: { alignItems: "center", padding: 20 },
        trash: {
            backgroundColor: colors.surface2,
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
        },
        dialogTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
        dialogText: { color: colors.muted, marginVertical: 12 },
        dialogActions: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
    });
