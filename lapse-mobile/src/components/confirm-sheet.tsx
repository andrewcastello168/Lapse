import { Modal, Text, View } from "react-native";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { useThemeColors } from "@/context/preferences";
export function ConfirmSheet({
  visible,
  title,
  children,
  confirm,
  onConfirm,
  onCancel,
  busy,
  error,
  danger = false,
  disabled = false,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,.38)",
          justifyContent: "flex-end",
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            padding: 26,
            paddingBottom: 42,
            maxWidth: 640,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <Text
            style={{
              color: c.text,
              fontSize: 23,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            {title}
          </Text>
          {children}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: c.danger, lineHeight: 21, marginBottom: 16 }}
            >
              {error}
            </Text>
          ) : null}
          <Button
            title={busy ? "Please wait…" : confirm}
            variant={danger ? "danger" : "primary"}
            disabled={busy || disabled}
            onPress={onConfirm}
          />
          <Button
            title="Cancel"
            variant="secondary"
            disabled={busy}
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
}
