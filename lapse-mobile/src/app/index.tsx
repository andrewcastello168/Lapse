import { router } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function Welcome() {
    const { user, initializing } = useAuth();

    useEffect(() => {
        if (!initializing && user) {
            router.replace("/(tabs)");
        }
    }, [initializing, user]);

    if (initializing || user) {
        return <View style={styles.loading} />;
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.hero}>
                <Image
                    source={require("@/assets/images/branding/logo-mark.png")}
                    style={styles.logo}
                />
                <Text style={styles.brand}>Lapse</Text>
                <Text style={styles.copy}>
                    Keep track of your important documents and subscriptions.
                    {"\n"}Never miss a renewal again.
                </Text>
            </View>
            <Button
                title="Get Started"
                onPress={() => router.push("/auth?mode=signup" as never)}
            />
            <Text style={styles.bottom}>
                Already have an account?{" "}
                <Text
                    onPress={() => router.push("/auth?mode=signin" as never)}
                    style={styles.link}
                >
                    Sign in
                </Text>
            </Text>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    safe: {
        flex: 1,
        backgroundColor: colors.bg,
        padding: spacing.lg,
        justifyContent: "space-between",
    },
    hero: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: spacing.md,
    },
    brand: {
        fontSize: 44,
        fontWeight: "900",
        color: colors.text,
    },
    copy: {
        color: colors.muted,
        textAlign: "center",
        fontSize: 15,
        lineHeight: 23,
        marginTop: spacing.md,
        maxWidth: 280,
    },
    bottom: {
        color: colors.muted,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    link: {
        color: colors.accent,
        fontWeight: "800",
    },
});
