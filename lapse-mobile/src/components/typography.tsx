import type { ComponentPropsWithRef } from "react";
import {
  TextInput as NativeTextInput,
  Text as NativeText,
  StyleSheet,
  type TextProps,
} from "react-native";
export function Text({ style, ...props }: TextProps) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const family =
    weight === "700" || weight === "800" || weight === "900"
      ? "JakartaBold"
      : weight === "600"
        ? "JakartaSemibold"
        : weight === "500"
          ? "JakartaMedium"
          : "JakartaRegular";
  return (
    <NativeText
      {...props}
      style={[style, { fontFamily: family, fontWeight: "normal" }]}
    />
  );
}

export function TextInput({
  style,
  ...props
}: ComponentPropsWithRef<typeof NativeTextInput>) {
  return (
    <NativeTextInput
      {...props}
      style={[{ fontFamily: "JakartaRegular" }, style]}
    />
  );
}
