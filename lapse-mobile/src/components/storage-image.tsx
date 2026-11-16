import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import { ImageOff } from "lucide-react-native";
import { useThemeColors } from "@/context/preferences";
export function StorageImage({
  uri,
  fallbackUri,
  size = 44,
}: {
  uri?: string | null;
  fallbackUri?: string | null;
  size?: number;
}) {
  const colors = useThemeColors();
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string>();
  const source = [uri, fallbackUri].find((url) => url && !failed.includes(url));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        backgroundColor: colors.surface2,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {!source || loaded !== source ? (
        <ImageOff size={size * 0.42} color={colors.muted} />
      ) : null}
      {source ? (
        <Image
          source={{ uri: source }}
          cachePolicy="memory-disk"
          contentFit="contain"
          style={{
            position: "absolute",
            width: size * 0.88,
            height: size * 0.88,
            opacity: loaded === source ? 1 : 0,
          }}
          onLoad={() => setLoaded(source)}
          onError={() => setFailed((old) => [...old, source])}
        />
      ) : null}
    </View>
  );
}
