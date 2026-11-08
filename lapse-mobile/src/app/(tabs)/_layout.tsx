import { Tabs } from "expo-router";
import { Alert, BackHandler, Platform, StyleSheet } from "react-native";
import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, Layers, Plus, UserRound } from "lucide-react-native";
import { colors } from "@/constants/theme";

export default function TabsLayout() {
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
                tabBarStyle: [styles.tabBar, { paddingBottom: bottomInset }],
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
                options={{
                    title: "Add",
                    tabBarIcon: ({ color, size }) => (
                        <Plus color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="items"
                options={{
                    title: "Items",
                    tabBarIcon: ({ color, size }) => (
                        <Layers color={color} size={size} />
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

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: colors.bg,
        borderTopColor: colors.border,
        height: 58,
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
