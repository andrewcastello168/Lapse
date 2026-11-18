import type { ConfigContext, ExpoConfig } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Lapse",
  slug: config.slug ?? "lapse-mobile",
  extra: {
    ...config.extra,
    ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
      : {}),
  },
  android: {
    ...config.android,
    ...(process.env.LAPSE_ANDROID_PACKAGE
      ? { package: process.env.LAPSE_ANDROID_PACKAGE }
      : {}),
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  ios: {
    ...config.ios,
    ...(process.env.LAPSE_IOS_BUNDLE_IDENTIFIER
      ? { bundleIdentifier: process.env.LAPSE_IOS_BUNDLE_IDENTIFIER }
      : {}),
  },
});
