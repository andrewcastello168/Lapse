import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/auth";
import { PreferencesProvider, usePreferences } from "@/context/preferences";

export default function RootLayout() {
    return (
        <AuthProvider>
            <PreferencesProvider>
                <AppNavigator />
            </PreferencesProvider>
        </AuthProvider>
    );
}
function AppNavigator() {
    const { colors, dark } = usePreferences();
    const { initializing } = useAuth();
    // Don't render protected screens or fetch data until session hydration completes.
    return (
        <>
            <StatusBar style={dark ? "light" : "dark"} />
            <RouteGuard />
            {initializing ? null : (
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.bg },
                    }}
                >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="auth" />
                    <Stack.Screen
                        name="add-flow"
                        options={{ gestureEnabled: false }}
                    />
                    <Stack.Screen name="item/[id]" />
                    <Stack.Screen name="settings" />
                </Stack>
            )}
        </>
    );
}
function RouteGuard() {
    const { user, initializing } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const pathname = usePathname();
    useEffect(() => {
        if (initializing) return;
        const inAuth = segments[0] === "auth";
        const inTabs = segments[0] === "(tabs)";
        const inFlow =
            segments[0] === "add-flow" ||
            segments[0] === "item" ||
            segments[0] === "settings";
        if (!user && (inTabs || inFlow)) router.replace("/auth?mode=signin");
        else if (user && inAuth) router.replace("/(tabs)");
        else if (user && !inTabs && !inFlow && pathname === "/")
            router.replace("/(tabs)");
    }, [initializing, pathname, router, segments, user]);
    return null;
}
