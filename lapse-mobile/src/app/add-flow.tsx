import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { StorageImage } from "@/components/storage-image";
import { Button, Card, Input, SectionTitle } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { api } from "@/services/api";
import type { Category, ExpiryType, MasterItem } from "@/types/models";

type Recurrence = {
    years: string;
    months: string;
    days: string;
};

const emptyRecurrence: Recurrence = {
    years: "",
    months: "",
    days: "",
};

function positiveInteger(value: string): number | undefined {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default function AddFlow() {
    const [step, setStep] = useState(1);
    const [categories, setCategories] = useState<Category[]>([]);
    const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
    const [category, setCategory] = useState<Category | null>(null);
    const [masterItem, setMasterItem] = useState<MasterItem | null>(null);
    const [itemName, setItemName] = useState("");
    const [search, setSearch] = useState("");
    const [expiryType, setExpiryType] = useState<ExpiryType>("ONCE");
    const [expiryDate, setExpiryDate] = useState("");
    const [recurrence, setRecurrence] = useState<Recurrence>(emptyRecurrence);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        api.categories()
            .then((result) => {
                if (active) {
                    setCategories(result);
                }
            })
            .catch((reason: unknown) => {
                if (active) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Unable to load categories.",
                    );
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!category) {
            return;
        }

        let active = true;
        setLoading(true);
        setMasterItems([]);

        api.items(category.id)
            .then((result) => {
                if (active) {
                    setMasterItems(result);
                }
            })
            .catch((reason: unknown) => {
                if (active) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Unable to load items.",
                    );
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [category]);

    const filteredMasterItems = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) {
            return masterItems;
        }

        return masterItems.filter((item) =>
            item.name.toLowerCase().includes(query),
        );
    }, [masterItems, search]);

    const resetFlow = () => {
        setStep(1);
        setCategory(null);
        setMasterItem(null);
        setItemName("");
        setSearch("");
        setExpiryType("ONCE");
        setExpiryDate("");
        setRecurrence(emptyRecurrence);
        setError("");
    };

    const save = async () => {
        setError("");

        if (!masterItem && !itemName.trim()) {
            setError("Enter an item name.");
            return;
        }

        if (expiryType !== "NEVER" && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
            setError("Enter a valid date in YYYY-MM-DD format.");
            return;
        }

        const years = positiveInteger(recurrence.years);
        const months = positiveInteger(recurrence.months);
        const days = positiveInteger(recurrence.days);
        if (expiryType === "RECURRING" && !years && !months && !days) {
            setError("Enter at least one positive recurrence interval.");
            return;
        }

        setSaving(true);
        try {
            await api.createItem({
                ...(masterItem ? { miId: masterItem.id } : {}),
                ...(!masterItem
                    ? { mcId: category?.id, itemName: itemName.trim() }
                    : {}),
                expiryType,
                ...(expiryType === "NEVER" ? {} : { expiryDate }),
                ...(expiryType === "RECURRING"
                    ? {
                          recurrenceYears: years,
                          recurrenceMonths: months,
                          recurrenceDays: days,
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
            setSaving(false);
        }
    };

    const goBack = () => {
        if (step === 1) {
            router.back();
            return;
        }

        setStep((current) => current - 1);
    };

    return (
        <View style={styles.root}>
            <ScrollView contentContainerStyle={styles.content}>
                <Pressable onPress={goBack} hitSlop={12}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.heading}>
                    {step === 4 ? "Item Added" : "Add Item"}
                </Text>
                {step < 4 ? (
                    <Text style={styles.progress}>STEP {step} OF 3</Text>
                ) : null}

                {step === 1 ? (
                    <>
                        <Text style={styles.title}>Choose a category</Text>
                        {loading ? (
                            <ActivityIndicator color={colors.accent} />
                        ) : null}
                        {categories.map((item) => (
                            <Card key={String(item.id)} style={styles.card}>
                                <StorageImage
                                    path={item.image_path}
                                    size={42}
                                />
                                <Pressable
                                    style={styles.cardAction}
                                    onPress={() => {
                                        setCategory(item);
                                        setStep(2);
                                    }}
                                >
                                    <Text style={styles.cardName}>
                                        {item.name}
                                    </Text>
                                </Pressable>
                            </Card>
                        ))}
                    </>
                ) : null}

                {step === 2 ? (
                    <>
                        <SectionTitle title="Choose an item" />
                        {masterItems.length > 0 ? (
                            <Input
                                label="Search"
                                placeholder="Search master items"
                                value={search}
                                onChangeText={setSearch}
                            />
                        ) : null}
                        {loading ? (
                            <ActivityIndicator color={colors.accent} />
                        ) : null}
                        {filteredMasterItems.map((item) => (
                            <Card key={String(item.id)} style={styles.card}>
                                <StorageImage
                                    path={item.image_path}
                                    size={42}
                                />
                                <Pressable
                                    style={styles.cardAction}
                                    onPress={() => {
                                        setMasterItem(item);
                                        setItemName(item.name);
                                        setStep(3);
                                    }}
                                >
                                    <Text style={styles.cardName}>
                                        {item.name}
                                    </Text>
                                </Pressable>
                            </Card>
                        ))}
                        <SectionTitle title="Or create a custom item" />
                        <Input
                            label="Item name"
                            placeholder="e.g. Passport renewal"
                            value={itemName}
                            onChangeText={setItemName}
                        />
                        <Button title="Continue" onPress={() => setStep(3)} />
                    </>
                ) : null}

                {step === 3 ? (
                    <>
                        <SectionTitle title="Expiration details" />
                        <View style={styles.segment}>
                            {(["ONCE", "RECURRING", "NEVER"] as const).map(
                                (type) => (
                                    <Pressable
                                        key={type}
                                        onPress={() => setExpiryType(type)}
                                        style={[
                                            styles.segmentItem,
                                            expiryType === type &&
                                                styles.segmentActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.segmentText,
                                                expiryType === type &&
                                                    styles.segmentTextActive,
                                            ]}
                                        >
                                            {type === "NEVER"
                                                ? "None"
                                                : type === "ONCE"
                                                  ? "Once"
                                                  : "Recurring"}
                                        </Text>
                                    </Pressable>
                                ),
                            )}
                        </View>
                        {expiryType !== "NEVER" ? (
                            <Input
                                label="First due date (YYYY-MM-DD)"
                                placeholder="2027-01-15"
                                value={expiryDate}
                                onChangeText={setExpiryDate}
                            />
                        ) : null}
                        {expiryType === "RECURRING" ? (
                            <>
                                <Input
                                    label="Years"
                                    keyboardType="number-pad"
                                    value={recurrence.years}
                                    onChangeText={(value) =>
                                        setRecurrence((current) => ({
                                            ...current,
                                            years: value,
                                        }))
                                    }
                                />
                                <Input
                                    label="Months"
                                    keyboardType="number-pad"
                                    value={recurrence.months}
                                    onChangeText={(value) =>
                                        setRecurrence((current) => ({
                                            ...current,
                                            months: value,
                                        }))
                                    }
                                />
                                <Input
                                    label="Days"
                                    keyboardType="number-pad"
                                    value={recurrence.days}
                                    onChangeText={(value) =>
                                        setRecurrence((current) => ({
                                            ...current,
                                            days: value,
                                        }))
                                    }
                                />
                            </>
                        ) : null}
                        <Button
                            title={saving ? "Saving..." : "Save item"}
                            onPress={save}
                            disabled={saving}
                        />
                    </>
                ) : null}

                {step === 4 ? (
                    <>
                        <Text style={styles.success}>✓</Text>
                        <Text style={styles.center}>
                            Your item has been successfully added.
                        </Text>
                        <Button title="Add another item" onPress={resetFlow} />
                        <Button
                            title="Go to items"
                            variant="secondary"
                            onPress={() => router.replace("/(tabs)/items")}
                        />
                    </>
                ) : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: 100,
    },
    back: {
        color: colors.text,
        fontSize: 34,
    },
    heading: {
        color: colors.text,
        fontSize: 24,
        fontWeight: "900",
        marginTop: spacing.md,
    },
    progress: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: "900",
        marginTop: 8,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: "900",
        marginVertical: spacing.xl,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
    },
    cardAction: {
        flex: 1,
    },
    cardName: {
        color: colors.text,
        fontWeight: "900",
        fontSize: 15,
    },
    segment: {
        flexDirection: "row",
        gap: 7,
        marginBottom: spacing.lg,
    },
    segmentItem: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: colors.surface,
    },
    segmentActive: {
        backgroundColor: colors.accent,
    },
    segmentText: {
        color: colors.muted,
        fontSize: 11,
    },
    segmentTextActive: {
        color: colors.bg,
        fontWeight: "900",
    },
    success: {
        alignSelf: "center",
        color: colors.accent,
        fontSize: 80,
        fontWeight: "900",
        marginTop: 80,
    },
    center: {
        color: colors.text,
        textAlign: "center",
        marginVertical: spacing.xl,
    },
    error: {
        color: colors.danger,
    },
});
