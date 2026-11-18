import { Platform } from "react-native";
export const colors = {
  onAccent: "#FFFFFF",
  badgeText: "#FFFFFF",
  dangerBadge: "#BE2637",
  warningBadge: "#8A641D",
  successBadge: "#006C59",
  bg: "#0A0A0A",
  surface: "#171717",
  surface2: "#202020",
  border: "#2A2A2A",
  text: "#F5F5F5",
  muted: "#A3A3A3",
  accent: "#00855F",
  accentDark: "#6DDCB0",
  accentTint: "#202020",
  danger: "#FF5964",
  warning: "#F5BE42",
  success: "#25D6A5",
} as const;
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const Fonts = Platform.select({
  ios: { sans: "System", rounded: "ui-rounded" },
  default: { sans: "normal", rounded: "normal" },
});
export const MaxContentWidth = 760;

export type Palette = { [K in keyof typeof colors]: string };
export const lightColors: Palette = {
  ...colors,
  bg: "#FFFEFC",
  surface: "#FFFFFF",
  surface2: "#F2F1F3",
  border: "#E7E5E8",
  text: "#181D1A",
  muted: "#717670",
  accent: "#007E58",
  accentDark: "#006E4D",
  accentTint: "#E1F8EE",
  danger: "#D82C43",
};
