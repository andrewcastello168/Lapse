import { CategoryIcon } from "@/components/category-icon";
import { useThemeColors } from "@/context/preferences";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    BackHandler,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Check, ChevronRight, Info, Search } from "lucide-react-native";
import { StorageImage } from "@/components/storage-image";
import { Button, Card, Input, Screen } from "@/components/ui";
import { ExpiryFields, type ExpiryDraft } from "@/components/expiry-fields";
import type { Palette } from "@/constants/theme";
import { api } from "@/services/api";
import type { Category, MasterItem } from "@/types/models";
import { parseDate } from "@/utils/item-dates";

const descriptions: Record<string, string> = {
    Identity: "KTP, SIM, Passport",
    Subscription: "Netflix, Spotify, gym, cloud storage",
    Vehicle: "Vehicle tax, STNK, service",
    Legal: "Contracts, insurance, permits",
    Others: "Anything else with a deadline",
};
const emptyDraft = (): ExpiryDraft => ({
    expiryType: "ONCE",
    expiryDate: "",
    interval: { years: 0, months: 0, days: 0 },
});

export default function AddFlow() {
    const colors = useThemeColors();
    const s = createStyles(colors);
    const [step, setStep] = useState(1);
    const [custom, setCustom] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
    const [category, setCategory] = useState<Category | null>(null);
    const [masterItem, setMasterItem] = useState<MasterItem | null>(null);
    const [itemName, setItemName] = useState("");
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState(emptyDraft);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        const request = category ? api.items(category.id) : api.categories();
        request
            .then((result) => {
                if (!active) return;
                if (category) setMasterItems(result as MasterItem[]);
                else setCategories(result as Category[]);
            })
            .catch((reason: unknown) => {
                if (active)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Unable to load items.",
                    );
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [category, retry]);

    const filtered = useMemo(
        () =>
            masterItems.filter((item) =>
                item.name.toLowerCase().includes(search.trim().toLowerCase()),
            ),
        [masterItems, search],
    );
    const goBack = () => {
        if (savingRef.current) return;
        setError("");
        if (step === 4 || step === 1) {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
        } else if (step === 3) setStep(2);
        else if (custom) setCustom(false);
        else {
            setStep(1);
            setLoading(true);
            setCategory(null);
        }
    };
    useEffect(() => {
        const listener = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                goBack();
                return true;
            },
        );
        return () => listener.remove();
    });
    const reset = () => {
        setLoading(true);
        setStep(1);
        setCategory(null);
        setMasterItem(null);
        setCustom(false);
        setItemName("");
        setSearch("");
        setDraft(emptyDraft());
        setError("");
    };
    const save = async () => {
        if (savingRef.current) return;
        setError("");
        if (!category || (!masterItem && !itemName.trim())) {
            setError("Enter an item name.");
            return;
        }
        if (draft.expiryType !== "NEVER" && !parseDate(draft.expiryDate)) {
            setError("Choose a valid date.");
            return;
        }
        if (
            draft.expiryType === "RECURRING" &&
            !Object.values(draft.interval).some((value) => value > 0)
        ) {
            setError("Enter at least one positive recurrence interval.");
            return;
        }
        savingRef.current = true;
        setSaving(true);
        try {
            await api.createItem({
                ...(masterItem
                    ? { miId: masterItem.id }
                    : { mcId: category.id, itemName: itemName.trim() }),
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
            setStep(4);
        } catch (reason: unknown) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : "Unable to save this item.",
            );
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };
    const identity = (
        <Card style={s.identity}>
            <>
                {masterItem ? (
                    <StorageImage path={masterItem.image_path} size={46} />
                ) : (
                    <CategoryIcon
                        name={category?.name}
                        path={category?.image_path}
                        size={46}
                    />
                )}
            </>
            <View style={s.main}>
                <Text style={s.name}>
                    {masterItem?.name ?? (itemName.trim() || "Custom item")}
                </Text>
                <Text style={s.meta}>
                    {category?.name}
                    {!masterItem ? " · Custom" : ""}
                </Text>
            </View>
        </Card>
    );
    const footer =
        step === 3 ? (
            <Button
                title={saving ? "Saving..." : "Save item"}
                onPress={save}
                disabled={saving}
            />
        ) : step === 2 && custom ? (
            <Button
                title="Continue"
                onPress={() => {
                    if (!itemName.trim()) {
                        setError("Enter an item name.");
                        return;
                    }
                    setError("");
                    setStep(3);
                }}
            />
        ) : undefined;

    return (
        <Screen
            title={step < 4 ? "Add Item" : undefined}
            onBack={step < 4 ? goBack : undefined}
            footer={footer}
        >
            {step < 4 ? (
                <View style={s.steps}>
                    {["Category", "Item", "Details"].map((label, index) => (
                        <View key={label} style={s.step}>
                            {index < 2 ? (
                                <View
                                    style={[
                                        s.line,
                                        step > index + 1 && {
                                            backgroundColor: colors.accentDark,
                                        },
                                    ]}
                                />
                            ) : null}
                            <View
                                style={[
                                    s.circle,
                                    step >= index + 1 && s.circleActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        s.stepNumber,
                                        step >= index + 1 && {
                                            color: colors.onAccent,
                                        },
                                    ]}
                                >
                                    {index + 1}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    s.stepLabel,
                                    step >= index + 1 && {
                                        color: colors.accent,
                                    },
                                ]}
                            >
                                {label}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}
            {step === 1 ? (
                <>
                    <Text style={s.title}>What are you tracking?</Text>
                    <Text style={s.help}>
                        Pick a category. You can choose a ready-made item or add
                        your own.
                    </Text>
                    {categories.map((item) => (
                        <Pressable
                            key={String(item.id)}
                            accessibilityRole="button"
                            onPress={() => {
                                setLoading(true);
                                setCategory(item);
                                setMasterItems([]);
                                setMasterItem(null);
                                setItemName("");
                                setSearch("");
                                setCustom(false);
                                setDraft(emptyDraft());
                                setError("");
                                setStep(2);
                            }}
                            style={({ pressed }) => [
                                s.category,
                                pressed && s.pressed,
                            ]}
                        >
                            <CategoryIcon
                                name={item.name}
                                path={item.image_path}
                                size={46}
                            />
                            <View style={s.main}>
                                <Text style={s.name}>{item.name}</Text>
                                <Text style={s.meta}>
                                    {descriptions[item.name]}
                                </Text>
                            </View>
                        </Pressable>
                    ))}
                </>
            ) : null}
            {step === 2 && !custom ? (
                <>
                    <View style={s.titleRow}>
                        <Text style={s.title}>Pick an item</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Change category"
                            onPress={() => {
                                setLoading(true);
                                setCategory(null);
                                setStep(1);
                            }}
                            style={s.chip}
                        >
                            <CategoryIcon
                                name={category?.name}
                                path={category?.image_path}
                                size={22}
                            />
                            <Text style={s.chipText}>{category?.name}</Text>
                            <ChevronRight size={14} color={colors.warning} />
                        </Pressable>
                    </View>
                    <View style={s.search}>
                        <Search color={colors.muted} size={16} />
                        <TextInput
                            style={s.searchInput}
                            placeholder="Search items..."
                            accessibilityLabel="Search items"
                            placeholderTextColor={colors.muted}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    {filtered.map((item) => (
                        <Pressable
                            key={String(item.id)}
                            accessibilityRole="button"
                            onPress={() => {
                                setMasterItem(item);
                                setCustom(false);
                                setItemName(item.name);
                                setError("");
                                setStep(3);
                            }}
                            style={({ pressed }) => [
                                s.category,
                                pressed && s.pressed,
                            ]}
                        >
                            <StorageImage path={item.image_path} size={40} />
                            <Text style={[s.name, s.main]}>{item.name}</Text>
                            <ChevronRight size={18} color={colors.muted} />
                        </Pressable>
                    ))}
                    {!loading && !error && !filtered.length ? (
                        <Text style={s.help}>
                            {search
                                ? "No items match your search."
                                : "No ready-made items in this category."}
                        </Text>
                    ) : null}
                    <Pressable
                        accessibilityRole="button"
                        style={s.custom}
                        onPress={() => {
                            setMasterItem(null);
                            setItemName("");
                            setCustom(true);
                            setError("");
                        }}
                    >
                        <CategoryIcon
                            name={category?.name}
                            path={category?.image_path}
                            size={48}
                        />
                        <View style={s.main}>
                            <Text style={s.name}>Add custom item</Text>
                            <Text style={s.meta}>
                                Uses the ‘{category?.name}’ icon automatically
                            </Text>
                        </View>
                    </Pressable>
                </>
            ) : null}
            {step === 2 && custom ? (
                <Card>
                    <Text style={s.title}>Custom item</Text>
                    {identity}
                    <Input
                        label="Item name"
                        value={itemName}
                        onChangeText={setItemName}
                        maxLength={100}
                    />
                    <View style={s.info}>
                        <Info size={16} color={colors.muted} />
                        <Text style={s.infoText}>
                            The icon follows the category you picked, so custom
                            items always look consistent with the rest.
                        </Text>
                    </View>
                </Card>
            ) : null}
            {step === 3 ? (
                <>
                    {identity}
                    <ExpiryFields value={draft} onChange={setDraft} />
                </>
            ) : null}
            {step === 4 ? (
                <View style={s.success}>
                    <View style={s.successIcon}>
                        {[
                            [-22, -12],
                            [10, -32],
                            [58, -24],
                            [115, -10],
                            [-30, 38],
                            [126, 40],
                            [-13, 99],
                            [112, 95],
                            [50, 122],
                        ].map(([left, top], index) => (
                            <View
                                key={index}
                                style={{
                                    position: "absolute",
                                    left,
                                    top,
                                    width: 5,
                                    height: 7,
                                    backgroundColor: [
                                        colors.accent,
                                        colors.warning,
                                        colors.danger,
                                    ][index % 3],
                                    transform: [{ rotate: "40deg" }],
                                }}
                            />
                        ))}
                        <Check
                            color={colors.onAccent}
                            size={64}
                            strokeWidth={3}
                        />
                    </View>
                    <Text style={s.successTitle}>Item added</Text>
                    <Text style={s.successText}>
                        {itemName.trim()} has been successfully added to your
                        items.
                    </Text>
                    <View style={s.successButtons}>
                        <Button title="Add another item" onPress={reset} />
                        <Button
                            title="Go to items"
                            variant="secondary"
                            onPress={() => router.replace("/(tabs)/items")}
                        />
                    </View>
                </View>
            ) : null}
            {loading && step < 3 && !custom ? (
                <ActivityIndicator color={colors.accent} />
            ) : null}
            {error ? (
                <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                        if (step < 3 && !custom) {
                            setLoading(true);
                            setError("");
                            setRetry((n) => n + 1);
                        }
                    }}
                >
                    <Text selectable accessibilityRole="alert" style={s.error}>
                        {error}
                        {step < 3 && !custom ? " Tap to retry." : ""}
                    </Text>
                </Pressable>
            ) : null}
        </Screen>
    );
}
const createStyles = (colors: Palette) =>
    StyleSheet.create({
        steps: { flexDirection: "row", marginBottom: 24, paddingHorizontal: 6 },
        step: { flex: 1, alignItems: "center" },
        line: {
            position: "absolute",
            top: 13,
            left: "50%",
            width: "100%",
            height: 1,
            backgroundColor: colors.border,
        },
        circle: {
            height: 26,
            width: 26,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: colors.muted,
            backgroundColor: colors.bg,
            alignItems: "center",
            justifyContent: "center",
        },
        circleActive: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        stepNumber: { color: colors.muted, fontSize: 12, fontWeight: "700" },
        stepLabel: { color: colors.muted, fontSize: 12, marginTop: 6 },
        title: {
            color: colors.text,
            fontSize: 19,
            fontWeight: "700",
            marginBottom: 8,
        },
        help: {
            color: colors.muted,
            fontSize: 14,
            lineHeight: 21,
            marginBottom: 14,
        },
        category: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: colors.surface,
            padding: 10,
            borderRadius: 8,
            marginBottom: 8,
        },
        main: { flex: 1 },
        name: { color: colors.text, fontSize: 14, fontWeight: "600" },
        meta: {
            color: colors.muted,
            fontSize: 12,
            marginTop: 4,
            lineHeight: 17,
        },
        pressed: { backgroundColor: colors.accentTint },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
        },
        chip: {
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            padding: 5,
            borderRadius: 6,
            backgroundColor: colors.surface,
        },
        chipText: { color: colors.warning, fontSize: 11 },
        search: {
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            paddingHorizontal: 10,
            minHeight: 44,
            borderRadius: 8,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
        },
        searchInput: {
            flex: 1,
            color: colors.text,
            fontSize: 13,
            paddingVertical: 10,
        },
        custom: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 4,
        },
        identity: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
            padding: 10,
        },
        info: { flexDirection: "row", gap: 6 },
        infoText: {
            flex: 1,
            color: colors.muted,
            fontSize: 12,
            lineHeight: 18,
        },
        success: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 40,
        },
        successIcon: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 30,
        },
        successTitle: {
            color: colors.text,
            fontSize: 26,
            fontWeight: "700",
            marginBottom: 12,
        },
        successText: {
            color: colors.muted,
            textAlign: "center",
            fontSize: 15,
            lineHeight: 23,
        },
        successButtons: { alignSelf: "stretch", marginTop: 26 },
        error: {
            color: colors.danger,
            fontSize: 13,
            marginTop: 16,
            lineHeight: 20,
        },
    });
