type ImageRow = {
  image_path?: string | null;
  category_image_path?: string | null;
};
export async function imageUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('SUPABASE_URL must be configured');
  const encoded = path
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  if (process.env.STORAGE_BUCKET_PUBLIC !== 'false')
    return `${base}/storage/v1/object/public/lapse-bucket/${encoded}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      'Private storage requires authorized delivery configuration',
    );
  const response = await fetch(
    `${base}/storage/v1/object/sign/lapse-bucket/${encoded}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  if (!response.ok) throw new Error('Unable to authorize catalog image');
  const result = (await response.json()) as { signedURL: string };
  return `${base}/storage/v1${result.signedURL}`;
}
export async function withImages<T extends ImageRow>(row: T) {
  return {
    ...row,
    image_url: await imageUrl(row.image_path ?? row.category_image_path),
    category_image_url: await imageUrl(row.category_image_path),
  };
}
