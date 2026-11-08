import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/auth";
import { colors } from "@/constants/theme";

export default function RootLayout() {
    return (
        <AuthProvider>
            <StatusBar style="light" />
            <RouteGuard />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.bg },
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="add-flow" />
            </Stack>
        </AuthProvider>
    );
}

function RouteGuard() {
    const { user, initializing } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (initializing) {
            return;
        }

        const inAuth = segments[0] === "auth";
        const inTabs = segments[0] === "(tabs)";
        const inAddFlow = segments[0] === "add-flow";

        if (!user && (inTabs || inAddFlow)) {
            router.replace("/auth?mode=signin");
        } else if (user && inAuth) {
            router.replace("/(tabs)");
        } else if (user && !inTabs && !inAddFlow && pathname === "/") {
            router.replace("/(tabs)");
        }
    }, [initializing, pathname, router, segments, user]);

    return null;
}
