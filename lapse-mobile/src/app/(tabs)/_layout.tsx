import { Tabs, useRouter, usePathname } from "expo-router";
import { Alert, BackHandler, Platform, View } from "react-native";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarDays,
  House,
  LayoutGrid,
  Plus,
  Settings,
} from "lucide-react-native";
import { useThemeColors } from "@/context/preferences";
export default function TabsLayout() {
  const c = useThemeColors();
  const inset = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pathname !== "/" && pathname !== "/(tabs)") {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
      } else
        Alert.alert("Exit Lapse?", "You are on the Home screen.", [
          { text: "Stay", style: "cancel" },
          {
            text: "Exit",
            style: "destructive",
            onPress: () => BackHandler.exitApp(),
          },
        ]);
      return true;
    });
    return () => listener.remove();
  }, [pathname, router]);
  const bottom = Math.max(inset.bottom, Platform.OS === "android" ? 8 : 4);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentDark,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          height: 62 + bottom,
          paddingBottom: bottom,
          paddingTop: 7,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarItemStyle: { minHeight: 48 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <House color={color} size={21} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          tabBarIcon: ({ color }) => <LayoutGrid color={color} size={21} />,
        }}
      />
      <Tabs.Screen
        name="add"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push("/add-flow");
          },
        }}
        options={{
          title: "",
          tabBarAccessibilityLabel: "Add item",
          tabBarIcon: () => (
            <View
              style={{
                backgroundColor: c.accent,
                width: 43,
                height: 43,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
              }}
            >
              <Plus color="white" size={26} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => <CalendarDays color={color} size={21} />,
        }}
      />
      <Tabs.Screen
        name="preferences"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings color={color} size={21} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
