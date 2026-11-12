import { CarFront, Crown, Ellipsis, FileText } from "lucide-react-native";
import { View } from "react-native";
import { StorageImage } from "@/components/storage-image";

// Category artwork follows the supplied UI reference, not the unrelated catalog
// thumbnails. Ready-made items continue to use their backend-provided artwork.
const icons = {
    Identity: { Icon: CarFront, background: "#194AB8", foreground: "#E8F0FF" },
    Subscription: { Icon: Crown, background: "#302B1B", foreground: "#FFD253" },
    Vehicle: { Icon: CarFront, background: "#28BDBB", foreground: "#F3D0F0" },
    Legal: { Icon: FileText, background: "#3D4DA5", foreground: "#E5EBFF" },
    Others: { Icon: Ellipsis, background: "#3C4E5A", foreground: "#F4FAF9" },
} as const;
export function CategoryIcon({
    name,
    path,
    size = 44,
}: {
    name?: string;
    path?: string | null;
    size?: number;
}) {
    const artwork = icons[name as keyof typeof icons];
    if (!artwork) return <StorageImage path={path} size={size} />;
    const { Icon, background, foreground } = artwork;
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size * 0.22,
                backgroundColor: background,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Icon
                color={foreground}
                fill={name === "Subscription" ? foreground : "none"}
                size={size * 0.65}
                strokeWidth={1.7}
            />
        </View>
    );
}
