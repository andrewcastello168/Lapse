import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>LAPSE</Text>
      <Text style={styles.title}>Upcoming</Text>
      <Text style={styles.subtitle}>
        Your important dates, all in one place.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1114",
    padding: 24,
    paddingTop: 64,
  },
  eyebrow: {
    color: "#54E1CD",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
  },
  title: {
    color: "#F4F7F8",
    fontSize: 32,
    fontWeight: "700",
    marginTop: 16,
  },
  subtitle: {
    color: "#9AA9AE",
    fontSize: 14,
    marginTop: 8,
  },
});
