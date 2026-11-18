import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarCheck } from "lucide-react-native";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui";
import { useThemeColors } from "@/context/preferences";
import { readLocal, writeLocal } from "@/utils/local";
export default function Welcome() {
  const c = useThemeColors();
  const { intro } = useLocalSearchParams<{ intro?: string }>();
  const [page, setPage] = useState(0),
    [width, setWidth] = useState(320);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    void readLocal("lapse.onboarding.v2").then((done) => {
      if (done && intro !== "1") router.replace("/auth?mode=signin");
    });
  }, [intro]);
  const go = (index: number) => {
    setPage(index);
    scroll.current?.scrollTo({ x: index * width, animated: false });
  };
  const finish = (signin = false) => {
    void writeLocal("lapse.onboarding.v2", "done");
    router.push(signin ? "/auth?mode=signin" : "/auth?mode=signup");
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          padding: 24,
        }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width - 48)}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => finish()}
          style={{ alignSelf: "flex-end", padding: 12 }}
        >
          <Text style={{ color: c.accentDark }}>Skip</Text>
        </Pressable>
        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) =>
            setPage(
              Math.max(
                0,
                Math.min(
                  1,
                  Math.round(event.nativeEvent.contentOffset.x / width),
                ),
              ),
            )
          }
        >
          {[0, 1].map((index) => (
            <View
              key={index}
              style={{
                width,
              }}
            >
              <ScrollView
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 16,
                }}
              >
                {index === 0 ? (
                  <>
                    <Image
                      source={require("../../assets/images/branding/logo-mark.png")}
                      style={{ width: 96, height: 96, marginBottom: 16 }}
                    />
                    <Text
                      style={{
                        fontSize: 48,
                        color: c.text,
                        fontWeight: "700",
                        marginBottom: 26,
                      }}
                    >
                      lapse.
                    </Text>
                  </>
                ) : (
                  <View
                    style={{
                      padding: 25,
                      backgroundColor: c.accentTint,
                      borderRadius: 40,
                      marginBottom: 36,
                    }}
                  >
                    <CalendarCheck size={100} color={c.accent} />
                  </View>
                )}
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "600",
                    lineHeight: 35,
                    textAlign: "center",
                    color: c.text,
                  }}
                >
                  {index === 0
                    ? "Stay ahead of expiration."
                    : "Never miss a renewal again."}
                </Text>
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 15,
                    lineHeight: 24,
                    textAlign: "center",
                    marginTop: 16,
                  }}
                >
                  {index === 0
                    ? "Track subscriptions, documents, licenses, and more in one place."
                    : "Get timely reminders for subscriptions, documents, and important deadlines."}
                </Text>
              </ScrollView>
            </View>
          ))}
        </ScrollView>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginVertical: 14,
          }}
        >
          {[0, 1].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Introduction ${n + 1}`}
              accessibilityState={{ selected: page === n }}
              onPress={() => go(n)}
              style={{ padding: 16 }}
            >
              <View
                style={{
                  height: 7,
                  width: 7,
                  borderRadius: 4,
                  backgroundColor: page === n ? c.accent : c.border,
                }}
              />
            </Pressable>
          ))}
        </View>
        {page > 0 ? (
          <Button
            title="Back"
            variant="secondary"
            onPress={() => go(page - 1)}
          />
        ) : null}
        <Button
          title={page === 0 ? "Continue" : "Get Started"}
          onPress={() => (page === 0 ? go(1) : finish())}
        />
        <Button
          title="I already have an account"
          variant="secondary"
          onPress={() => finish(true)}
        />
      </View>
    </SafeAreaView>
  );
}
