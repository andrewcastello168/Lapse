import { View, Text } from "react-native";

export default function ItemsScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0B1114",
        padding: 24,
        paddingTop: 64,
      }}
    >
      <Text style={{ color: "#F4F7F8", fontSize: 30, fontWeight: "700" }}>
        My Items
      </Text>
    </View>
  );
}
