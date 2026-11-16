import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarCheck } from "lucide-react-native";
import { Button } from "@/components/ui";
import { useThemeColors } from "@/context/preferences";
export default function Welcome() {
  const c = useThemeColors();
  const [page, setPage] = useState(0);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          padding: 28,
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: 30,
          }}
        >
          {page === 1 ? (
            <View
              style={{
                width: 166,
                height: 166,
                backgroundColor: c.accentTint,
                borderRadius: 48,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ rotate: "-8deg" }],
                marginBottom: 38,
              }}
            >
              <CalendarCheck size={108} color={c.accent} strokeWidth={1.3} />
            </View>
          ) : (
            <>
              <Image
                source={require("@/assets/images/branding/logo-mark.png")}
                style={{ width: 96, height: 96, marginBottom: 20 }}
              />
              <Text
                style={{
                  color: c.text,
                  fontWeight: "800",
                  fontSize: 52,
                  letterSpacing: -2,
                  marginBottom: 38,
                }}
              >
                lapse.
              </Text>
            </>
          )}
          <Text
            style={{
              fontSize: 29,
              fontWeight: "700",
              letterSpacing: -0.8,
              lineHeight: 34,
              textAlign: "center",
              color: c.text,
            }}
          >
            {page === 1
              ? "Never miss a\nrenewal again."
              : "Stay ahead of\nexpiration."}
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 23,
              textAlign: "center",
              color: c.muted,
              maxWidth: 275,
              marginTop: 16,
            }}
          >
            {page === 1
              ? "Get timely reminders for subscriptions, documents, and important deadlines."
              : "Track subscriptions, documents, licenses, and more in one place."}
          </Text>
          <View style={{ flexDirection: "row", gap: 7, marginTop: 28 }}>
            {[0, 1].map((index) => (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Introduction ${index + 1}`}
                onPress={() => setPage(index)}
                hitSlop={12}
              >
                <View
                  style={{
                    height: 6,
                    width: 6,
                    borderRadius: 3,
                    backgroundColor: index === page ? c.accent : c.border,
                  }}
                />
              </Pressable>
            ))}
          </View>
        </View>
        <Button
          title={page === 0 ? "Get started" : "Create account"}
          onPress={() =>
            page === 0 ? setPage(1) : router.push("/auth?mode=signup")
          }
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/auth?mode=signin")}
          style={{ padding: 18, alignItems: "center" }}
        >
          <Text
            style={{ fontSize: 13, fontWeight: "600", color: c.accentDark }}
          >
            I already have an account
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
