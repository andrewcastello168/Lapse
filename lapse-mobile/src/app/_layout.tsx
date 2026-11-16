import {
  Stack,
  useGlobalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/auth";
import { PreferencesProvider, usePreferences } from "@/context/preferences";
import { NotificationsProvider } from "@/context/notifications";

export default function RootLayout() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <NotificationsProvider>
          <AppNavigator />
        </NotificationsProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
function AppNavigator() {
  const { colors, dark, ready } = usePreferences();
  const { initializing } = useAuth();
  // Don't render protected screens or fetch data until session hydration completes.
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <RouteGuard />
      {initializing || !ready ? null : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="add-flow" options={{ gestureEnabled: false }} />
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
  const params = useGlobalSearchParams<{ mode?: string }>();
  useEffect(() => {
    if (initializing) return;
    const inAuth = segments[0] === "auth";
    const inTabs = segments[0] === "(tabs)";
    const inFlow = !!segments[0] && !inAuth && !inTabs;
    if (!user && (inTabs || inFlow)) router.replace("/auth?mode=signin");
    else if (
      user &&
      inAuth &&
      params.mode !== "reset" &&
      params.mode !== "forgot"
    )
      router.replace("/(tabs)");
    else if (user && !inTabs && !inFlow && pathname === "/")
      router.replace("/(tabs)");
  }, [initializing, pathname, router, segments, user, params.mode]);
  return null;
}
