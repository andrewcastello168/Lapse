import { StorageImage } from "@/components/storage-image";
export function CategoryIcon({
  uri,
  size = 44,
}: {
  uri?: string | null;
  size?: number;
}) {
  return <StorageImage uri={uri} size={size} />;
}
