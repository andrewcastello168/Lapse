import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/context/preferences";

// A Modal has its own native window; the screen's keyboard avoidance cannot
// protect it. Keep the whole sheet scrollable even with large text/landscape.
export function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,.38)",
          justifyContent: "flex-end",
          paddingTop: insets.top + 12,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "100%",
            width: "100%",
            maxWidth: 640,
            alignSelf: "center",
            backgroundColor: c.bg,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            overflow: "hidden",
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              padding: 20,
              paddingLeft: 20 + insets.left,
              paddingRight: 20 + insets.right,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
