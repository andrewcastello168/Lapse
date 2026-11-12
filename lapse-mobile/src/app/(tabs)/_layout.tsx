import { useThemeColors } from "@/context/preferences";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Alert, BackHandler, Platform, StyleSheet } from "react-native";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CirclePlus, House, LayoutGrid, UserRound } from "lucide-react-native";
import type { Palette } from "@/constants/theme";

export default function TabsLayout() {
    const colors = useThemeColors();
    const styles = createStyles(colors);
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const router = useRouter();
    const bottomInset = Math.max(
        insets.bottom,
        Platform.OS === "android" ? 8 : 0,
    );

    useEffect(() => {
        if (Platform.OS !== "android") {
            return;
        }

        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                if (pathname !== "/" && pathname !== "/(tabs)") {
                    router.back();
                    return true;
                }

                Alert.alert("Exit Lapse?", "You are on the Home screen.", [
                    { text: "Stay", style: "cancel" },
                    {
                        text: "Exit",
                        style: "destructive",
                        onPress: () => BackHandler.exitApp(),
                    },
                ]);
                return true;
            },
        );

        return () => subscription.remove();
    }, [pathname, router]);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.muted,
                tabBarStyle: [
                    styles.tabBar,
                    { paddingBottom: bottomInset, height: 56 + bottomInset },
                ],
                tabBarLabelStyle: styles.label,
                tabBarItemStyle: styles.item,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, size }) => (
                        <House color={color} size={size} />
                    ),
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
                    title: "Add",
                    tabBarIcon: ({ color, size }) => (
                        <CirclePlus color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="items"
                options={{
                    title: "Items",
                    tabBarIcon: ({ color, size }) => (
                        <LayoutGrid color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, size }) => (
                        <UserRound color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}

const createStyles = (colors: Palette) =>
    StyleSheet.create({
        tabBar: {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            minHeight: 56,
            paddingTop: 6,
        },
        label: {
            fontSize: 11,
            fontWeight: "700",
        },
        item: {
            minHeight: 48,
        },
    });
