export type ExpiryType = "ONCE" | "NEVER" | "RECURRING";
export type Category = {
    id: number | string;
    name: string;
    image_path?: string | null;
};
export type MasterItem = {
    id: number | string;
    mc_id: number | string;
    name: string;
    image_path?: string | null;
};
export type UserItem = {
    id: number | string;
    user_id?: number | string;
    mi_id?: number | string | null;
    mc_id: number | string;
    item_name: string;
    expiry_type: ExpiryType;
    recurrence_years?: number | null;
    recurrence_months?: number | null;
    recurrence_days?: number | null;
    expiry_date?: string | null;
    image_path?: string | null;
    category_image_path?: string | null;
    category_name?: string;
};
export type TimelineOccurrence = {
    userItemId: string | number;
    masterItemId?: string | number | null;
    categoryId: string | number;
    itemName: string;
    expiryType: ExpiryType;
    occurrenceDate: string;
};
export type SessionUser = { id: string; name: string; email: string };
export type AuthSession = {
    accessToken: string;
    refreshToken: string;
    user: SessionUser;
};
