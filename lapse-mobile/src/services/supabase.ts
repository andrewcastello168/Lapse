const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export const storageBucket = 'lapse-bucket';

export const supabase = {
    storage: {
        from: (bucket: string) => ({
            getPublicUrl: (imagePath: string) => ({
                data: {
                    publicUrl: `${url}/storage/v1/object/public/${bucket}/${imagePath.replace(/^\/+/, '')}`,
                },
            }),
        }),
    },
};
