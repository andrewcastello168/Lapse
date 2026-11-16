import { useThemeColors } from "@/context/preferences";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, type Palette } from "@/constants/theme";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  const s = createStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === "secondary" && s.secondary,
        variant === "danger" && { backgroundColor: colors.danger },
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          {
            color: variant === "secondary" ? colors.text : colors.onAccent,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Input({
  label,
  ...props
}: TextInputProps & { label?: string }) {
  const colors = useThemeColors();
  const s = createStyles(colors);
  return (
    <View style={s.group}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput
        accessibilityLabel={label ?? props.placeholder}
        placeholderTextColor={colors.muted}
        {...props}
        style={[s.input, props.style]}
      />
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const s = createStyles(colors);
  return <View style={[s.card, style]}>{children}</View>;
}
export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const s = createStyles(colors);
  return (
    <View style={s.row}>
      <Text style={s.title}>{title}</Text>
      {action && (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
          <Text style={s.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Compact centered flow headers and left-aligned tab titles from the reference.
export function Screen({
  children,
  footer,
  title,
  onBack,
  trailing,
  scroll = true,
}: {
  children: ReactNode;
  footer?: ReactNode;
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  scroll?: boolean;
}) {
  const colors = useThemeColors();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={[s.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {title ? (
        <View style={s.header}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              style={s.headerAction}
            >
              <ChevronLeft size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <Text style={[s.headerTitle, !onBack && s.tabTitle]}>{title}</Text>
          {trailing ? <View style={s.trailing}>{trailing}</View> : null}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
      {footer ? (
        <View
          style={[
            s.footer,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: {
      minHeight: 48,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    headerAction: {
      position: "absolute",
      left: 4,
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      textAlign: "center",
    },
    tabTitle: { textAlign: "left", fontSize: 22 },
    trailing: { position: "absolute", right: spacing.md },
    content: {
      flexGrow: 1,
      padding: 22,
      paddingTop: spacing.sm,
      width: "100%",
      maxWidth: 640,
      alignSelf: "center",
      paddingBottom: 28,
    },
    footer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      backgroundColor: colors.bg,
    },
    button: {
      minHeight: 48,
      borderRadius: radius.md,
      paddingVertical: 13,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: spacing.xs,
      backgroundColor: colors.accent,
    },
    secondary: {
      backgroundColor: "transparent",
      borderColor: colors.border,
      borderWidth: 1,
    },
    buttonText: { fontSize: 14, fontWeight: "700" },
    group: { marginBottom: spacing.md },
    label: { color: colors.text, fontSize: 13, marginBottom: 6 },
    input: {
      minHeight: 50,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    card: {
      backgroundColor: colors.surface2,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    title: { color: colors.text, fontSize: 17, fontWeight: "700" },
    action: { color: colors.accent, fontWeight: "600", fontSize: 13 },
  });
