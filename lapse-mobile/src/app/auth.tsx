import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
} from "react-native";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { colors, spacing } from "@/constants/theme";

export default function Auth() {
    const { mode = "signin" } = useLocalSearchParams<{ mode?: string }>();
    const signup = mode === "signup";
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { signIn, signUp, loading, error } = useAuth();

    const submit = async () => {
        const success = signup
            ? await signUp(name.trim(), email.trim(), password)
            : await signIn(email.trim(), password);
        if (success) {
            router.replace("/(tabs)");
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.root}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.logo}>LAPSE</Text>
                <Text style={styles.heading}>
                    {signup ? "Create an account" : "Welcome back"}
                </Text>
                <Text style={styles.sub}>
                    {signup
                        ? "Start managing your documents today."
                        : "Sign in to your account"}
                </Text>
                {signup ? (
                    <Input
                        label="Full name"
                        placeholder="Andrew Castello"
                        value={name}
                        onChangeText={setName}
                    />
                ) : null}
                <Input
                    label="Email"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />
                <Input
                    label="Password"
                    placeholder="Password"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button
                    title={
                        loading
                            ? "Please wait..."
                            : signup
                              ? "Create account"
                              : "Sign in"
                    }
                    disabled={loading}
                    onPress={submit}
                />
                <Text style={styles.switch}>
                    {signup
                        ? "Already have an account? "
                        : "Don't have an account? "}
                    <Text
                        style={styles.link}
                        onPress={() =>
                            router.setParams({
                                mode: signup ? "signin" : "signup",
                            })
                        }
                    >
                        {signup ? "Sign in" : "Sign up"}
                    </Text>
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    container: {
        padding: spacing.lg,
        paddingTop: 64,
    },
    back: {
        color: colors.text,
        fontSize: 34,
        marginBottom: spacing.xl,
    },
    logo: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: "900",
        letterSpacing: 2,
    },
    heading: {
        color: colors.text,
        fontSize: 30,
        fontWeight: "900",
        marginTop: spacing.md,
    },
    sub: {
        color: colors.muted,
        marginTop: 6,
        marginBottom: spacing.xl,
    },
    switch: {
        color: colors.muted,
        textAlign: "center",
        marginTop: spacing.lg,
    },
    link: {
        color: colors.accent,
        fontWeight: "800",
    },
    error: {
        color: colors.danger,
        marginBottom: spacing.sm,
    },
});
