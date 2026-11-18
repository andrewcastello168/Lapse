import { ActivityIndicator, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Stack,
  useGlobalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/context/auth";
import { PreferencesProvider, usePreferences } from "@/context/preferences";
import { NotificationsProvider } from "@/context/notifications";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    JakartaRegular: require("../../assets/fonts/Jakarta-400.ttf"),
    JakartaMedium: require("../../assets/fonts/Jakarta-500.ttf"),
    JakartaSemibold: require("../../assets/fonts/Jakarta-600.ttf"),
    JakartaBold: require("../../assets/fonts/Jakarta-700.ttf"),
  });
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontWaitExpired(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (fontsLoaded || fontError || fontWaitExpired)
      void SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError, fontWaitExpired]);
  // Render with the system fallback while fonts load; never gate auth on fonts.
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
      {initializing || !ready ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.bg,
          }}
        >
          <ActivityIndicator
            accessibilityLabel="Loading Lapse"
            color={colors.accent}
          />
        </View>
      ) : (
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
  const params = useGlobalSearchParams<{ mode?: string; intro?: string }>();
  useEffect(() => {
    if (initializing) return;
    const inAuth = segments[0] === "auth";
    const inTabs = segments[0] === "(tabs)";
    const inFlow = !!segments[0] && !inAuth && !inTabs;
    if (!user && pathname === "/" && params.intro !== "1")
      router.replace("/auth?mode=signin");
    else if (!user && (inTabs || inFlow)) router.replace("/auth?mode=signin");
    else if (
      user &&
      inAuth &&
      params.mode !== "reset" &&
      params.mode !== "forgot"
    )
      router.replace("/(tabs)");
    else if (user && !inTabs && !inFlow && pathname === "/")
      router.replace("/(tabs)");
  }, [
    initializing,
    pathname,
    router,
    segments,
    user,
    params.mode,
    params.intro,
  ]);
  return null;
}
