import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { ChevronRight, Plus } from "lucide-react-native";
import { Card } from "@/components/ui";
import { StorageImage } from "@/components/storage-image";
import { colors, spacing } from "@/constants/theme";
import { api } from "@/services/api";
import type { Category } from "@/types/models";

const descriptions: Record<string, string> = {
    Identity: "KTP, SIM, Passport",
    Subscription: "Netflix, Spotify, cloud storage",
    Vehicle: "Tax, STNK, service",
    Legal: "Contracts, insurance, permits",
    Others: "Anything with a deadline",
};

export default function Add() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
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

    return (
        <View style={styles.root}>
            <ScrollView contentContainerStyle={styles.content}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.heading}>Add Item</Text>
                <Text style={styles.sub}>What are you tracking?</Text>
                <Text style={styles.help}>
                    Pick a category. You can choose a ready-made item or add
                    your own.
                </Text>

                {loading ? <ActivityIndicator color={colors.accent} /> : null}
                {categories.map((category) => (
                    <Card key={String(category.id)} style={styles.card}>
                        <StorageImage path={category.image_path} size={44} />
                        <View style={styles.main}>
                            <Text style={styles.name}>{category.name}</Text>
                            <Text style={styles.desc}>
                                {descriptions[category.name] ??
                                    "Items with a deadline"}
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => router.push("/add-flow" as never)}
                            hitSlop={12}
                        >
                            <ChevronRight color={colors.muted} size={18} />
                        </Pressable>
                    </Card>
                ))}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable onPress={() => router.push("/add-flow" as never)}>
                    <Card style={styles.custom}>
                        <Plus color={colors.accent} />
                        <Text style={styles.customText}>Add a custom item</Text>
                    </Card>
                </Pressable>
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
        paddingBottom: 110,
    },
    back: {
        color: colors.text,
        fontSize: 34,
    },
    heading: {
        color: colors.text,
        fontSize: 30,
        fontWeight: "900",
        marginTop: spacing.md,
    },
    sub: {
        color: colors.text,
        fontSize: 19,
        fontWeight: "900",
        marginTop: spacing.xl,
    },
    help: {
        color: colors.muted,
        lineHeight: 20,
        marginTop: 8,
        marginBottom: spacing.md,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
        padding: 12,
    },
    main: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        color: colors.text,
        fontWeight: "900",
    },
    desc: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 4,
    },
    custom: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: spacing.md,
    },
    customText: {
        color: colors.accent,
        fontWeight: "900",
    },
    error: {
        color: colors.danger,
        marginTop: spacing.sm,
    },
});
