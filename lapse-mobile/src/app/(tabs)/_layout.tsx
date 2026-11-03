import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { House, Plus, Layers, UserRound } from "lucide-react-native";

const COLORS = {
  background: "#0B1114",
  surface: "#141D21",
  inactive: "#829096",
  primary: "#54E1CD",
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: "#263338",
          height: Platform.OS === "ios" ? 86 : 68,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? 24 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarIcon: ({ color, size }) => <Plus color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          tabBarIcon: ({ color, size }) => <Layers color={color} size={size} />,
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
