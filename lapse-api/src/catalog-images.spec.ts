import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageUrl, withImages } from './catalog-images.js';
afterEach(() => vi.unstubAllEnvs());
describe('catalog image delivery', () => {
  it('preserves exact filenames and encodes individual path segments', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('STORAGE_BUCKET_PUBLIC', 'true');
    expect(await imageUrl('master-items/Netflix Premium (ID).png')).toBe(
      'https://example.supabase.co/storage/v1/object/public/lapse-bucket/master-items/Netflix%20Premium%20(ID).png',
    );
  });
  it('uses category fallback and returns null for missing artwork', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    const result = await withImages({
      image_path: null,
      category_image_path: 'exact/category.webp',
    });
    expect(result.image_url).toBe(result.category_image_url);
    expect(await imageUrl(null)).toBeNull();
  });
  it('never serves assumed public URLs for a configured private bucket', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('STORAGE_BUCKET_PUBLIC', 'false');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(imageUrl('private.png')).rejects.toThrow('authorized');
  });
});
