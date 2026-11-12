import { Platform } from "react-native";
export const colors = {
    onAccent: "#041113",
    badgeText: "#FFFFFF",
    dangerBadge: "#BE2637",
    warningBadge: "#8A641D",
    successBadge: "#006C59",
    bg: "#041113",
    surface: "#0D1C20",
    surface2: "#15262E",
    border: "#24383D",
    text: "#F4FAF9",
    muted: "#A7B7C0",
    accent: "#00E5BD",
    accentDark: "#0B8F7B",
    accentTint: "#073D33",
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
    bg: "#F5F9F8",
    surface: "#FFFFFF",
    surface2: "#E5EEED",
    border: "#C8D8D5",
    text: "#102522",
    muted: "#4E6560",
    accent: "#00B995",
    accentTint: "#D6F6EC",
};
