import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ImageOff } from "lucide-react-native";
import { useThemeColors } from "@/context/preferences";
import { storageUrl } from "@/utils/storage";
export function StorageImage({
    path,
    size = 44,
}: {
    path?: string | null;
    size?: number;
}) {
    const colors = useThemeColors();
    const uri = storageUrl(path);
    const [failedUri, setFailedUri] = useState<string>();
    return (
        <View
            style={[
                s.box,
                {
                    backgroundColor: colors.surface2,
                    width: size,
                    height: size,
                    borderRadius: size * 0.22,
                },
            ]}
        >
            {uri && failedUri !== uri ? (
                <Image
                    source={{ uri }}
                    cachePolicy="memory-disk"
                    style={{ width: size * 0.82, height: size * 0.82 }}
                    contentFit="contain"
                    onError={() => setFailedUri(uri)}
                />
            ) : (
                <ImageOff size={size * 0.42} color={colors.muted} />
            )}
        </View>
    );
}
const s = StyleSheet.create({
    box: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
