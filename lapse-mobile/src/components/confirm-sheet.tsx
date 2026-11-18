import { BottomSheet } from "./bottom-sheet";
import { Text } from "@/components/typography";
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
    <BottomSheet
      visible={visible}
      onClose={() => {
        if (!busy) onCancel();
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
    </BottomSheet>
  );
}
