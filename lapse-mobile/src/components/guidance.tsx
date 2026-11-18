import { tourKey, tourExplanation } from "@/utils/guidance";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useLocalSearchParams } from "expo-router";
import { Text } from "./typography";
import { usePreferences } from "@/context/preferences";
import { useAuth } from "@/context/auth";
import { readLocal, writeLocal } from "@/utils/local";
class ScrollState {
  node: ComponentRef<typeof ScrollView> | null = null;
  y = 0;
  attach(node: ComponentRef<typeof ScrollView> | null) {
    this.node = node;
  }
  track(y: number) {
    this.y = y;
  }
}
const ScrollRegistry = createContext(new ScrollState());
export function GuidedScroll({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: import("react-native").StyleProp<
    import("react-native").ViewStyle
  >;
}) {
  const scroll = useContext(ScrollRegistry);
  return (
    <ScrollView
      ref={(node) => {
        scroll.attach(node);
      }}
      onScroll={(event) => {
        scroll.track(event.nativeEvent.contentOffset.y);
      }}
      scrollEventThrottle={16}
      style={{ flex: 1, minHeight: 0 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </ScrollView>
  );
}
const Registry = createContext<Map<string, ComponentRef<typeof View>> | null>(
  null,
);
export function GuideTarget({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const registry = useContext(Registry);
  return (
    <View
      collapsable={false}
      ref={(node) => {
        if (node) registry?.set(name, node);
        else registry?.delete(name);
      }}
    >
      {children}
    </View>
  );
}
export function Guidance({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const path = usePathname(),
    { user } = useAuth(),
    { colors: c } = usePreferences();
  const [scroll] = useState(() => new ScrollState());
  const [targets] = useState(
    () => new Map<string, ComponentRef<typeof View>>(),
  );
  const [entries, setEntries] = useState<string[]>([]);
  const [offered, setOffered] = useState(false),
    [step, setStep] = useState(-1),
    [rect, setRect] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null);
  const { height, width } = useWindowDimensions();
  const { section = "", tour } = useLocalSearchParams<{
    section?: string;
    tour?: string;
  }>();
  const key = tourKey(user?.id ?? "guest", path, section);
  useEffect(() => {
    let active = true;
    if (user && (path === "/" || path === "/index"))
      void readLocal(key)
        .then((done) => {
          if (active && !done) setOffered(true);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [key, path, user]);
  const start = () => {
    setEntries(
      [...targets.keys()]
        .filter((name) => !name.startsWith("Help"))
        .slice(0, 5),
    );
    setStep(0);
    setOffered(false);
  };
  useEffect(() => {
    if (tour === "replay") {
      const timer = setTimeout(() => {
        setEntries([...targets.keys()].slice(0, 5));
        setStep(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [tour, targets]);
  const close = () => {
    setStep(-1);
    setOffered(false);
    void writeLocal(key, "done").catch(() => {});
  };
  useEffect(() => {
    let active = true;
    let remeasure: ReturnType<typeof setTimeout> | undefined;
    const measure = (retry: boolean) => {
      const node = targets.get(entries[step]);
      if (!node) return;
      node.measureInWindow((x, y, w, h) => {
        if (!active) return;
        if (retry && (y < 70 || y + h > height - 260) && scroll.node) {
          scroll.node.scrollTo({
            y: Math.max(0, scroll.y + y - 90),
            animated: false,
          });
          remeasure = setTimeout(() => measure(false), 150);
          return;
        }
        if (y >= 0 && y < height - 260)
          setRect({ x, y, width: w, height: Math.min(h, height - 270 - y) });
      });
    };
    const timer = setTimeout(() => {
      setRect(null);
      if (step >= 0) measure(true);
    }, 60);
    return () => {
      active = false;
      clearTimeout(timer);
      if (remeasure) clearTimeout(remeasure);
    };
  }, [step, height, entries, targets, scroll]);

  const button = (label: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={action}
      style={{ padding: 12, minHeight: 44 }}
    >
      <Text style={{ color: c.accentDark }}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollRegistry.Provider value={scroll}>
      <Registry.Provider value={targets}>
        {children}
        <Modal
          visible={offered || step >= 0}
          transparent
          animationType="none"
          onRequestClose={close}
          statusBarTranslucent
          navigationBarTranslucent
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#0009",
              justifyContent: "flex-end",
            }}
          >
            {rect && step >= 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: rect.x,
                  top: rect.y,
                  width: Math.min(rect.width, width - rect.x),
                  height: rect.height,
                  borderWidth: 3,
                  borderColor: c.accentDark,
                  borderRadius: 12,
                }}
              />
            ) : null}
            <ScrollView
              accessibilityViewIsModal
              style={{
                backgroundColor: c.surface,
                borderRadius: 20,
                maxHeight: height * 0.65,
                flexGrow: 0,
              }}
              contentContainerStyle={{
                padding: 22,
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              }}
            >
              <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
                {offered
                  ? "A quick look around?"
                  : (entries[step] ?? "Explore this screen")}
              </Text>
              <Text style={{ color: c.muted, lineHeight: 23, marginTop: 12 }}>
                {offered
                  ? "Take an optional short tour. You can skip and replay from Help & Support."
                  : tourExplanation(entries[step] ?? path)}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                {offered ? (
                  button("Start", start)
                ) : (
                  <>
                    {step > 0 ? button("Back", () => setStep(step - 1)) : null}
                    {button(
                      step >= entries.length - 1 ? "Finish" : "Next",
                      () =>
                        step >= entries.length - 1
                          ? close()
                          : setStep(step + 1),
                    )}
                  </>
                )}
                {button("Skip", close)}
                {button("Close", close)}
              </View>
            </ScrollView>
          </View>
        </Modal>
      </Registry.Provider>
    </ScrollRegistry.Provider>
  );
}
