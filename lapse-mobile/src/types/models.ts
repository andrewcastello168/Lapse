export type ExpiryType = "ONCE" | "NEVER" | "RECURRING";
export type RenewalMode = "AUTOMATIC" | "MANUAL";
export type ExpirationStatus =
  "NO_EXPIRY" | "OVERDUE" | "DUE_TODAY" | "EXPIRING_SOON" | "UPCOMING";
export type Category = {
  id: number | string;
  name: string;
  image_path?: string | null;
  image_url?: string | null;
};
export type MasterItem = Category & {
  expiry_date?: string | null;
  mc_id: number | string;
  category_image_url?: string | null;
  expiry_type?: ExpiryType;
  recurrence_years?: number | null;
  recurrence_months?: number | null;
  recurrence_days?: number | null;
  renewal_mode?: RenewalMode | null;
};
export type UserItem = {
  id: string;
  user_id?: string;
  mi_id?: number | string | null;
  mc_id: number | string;
  item_name: string;
  expiry_type: ExpiryType;
  expiry_date: string | null;
  recurrence_years: number | null;
  recurrence_months: number | null;
  recurrence_days: number | null;
  renewal_mode: RenewalMode | null;
  renewed_through: string | null;
  effective_expiry_date: string | null;
  next_scheduled_date: string | null;
  days_remaining: number | null;
  expiration_status: ExpirationStatus;
  can_renew: boolean;
  image_url?: string | null;
  category_image_url?: string | null;
  image_path?: string | null;
  category_image_path?: string | null;
  category_name?: string;
};
export type TimelineOccurrence = {
  userItemId: string;
  masterItemId?: string | number | null;
  categoryId: string | number;
  itemName: string;
  expiryType: ExpiryType;
  occurrenceDate: string;
  projected: boolean;
  renewalMode?: RenewalMode | null;
  image_url?: string | null;
  category_image_url?: string | null;
};
export type TimelinePage = {
  from: string;
  to: string;
  total: number;
  itemCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  data: TimelineOccurrence[];
};
export type Reminder = {
  id: string;
  itemId: string;
  itemName: string;
  occurrenceDate: string;
  offset: number;
  scheduledAt: string;
};
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  timezone?: string | null;
};
export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};
export type ItemInput = {
  miId?: number | string;
  mcId?: number | string;
  itemName?: string;
  expiryType: ExpiryType;
  expiryDate?: string;
  recurrenceYears?: number;
  recurrenceMonths?: number;
  recurrenceDays?: number;
  renewalMode?: RenewalMode;
  resetConfirmation?: boolean;
  expectedRenewedThrough?: string;
};
