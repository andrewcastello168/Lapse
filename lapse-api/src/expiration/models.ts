import type { Schedule } from './calendar.js';
export type UserItemRow = Schedule & {
  id: string;
  user_id: string;
  mi_id: string | number | null;
  mc_id: number;
  item_name: string;
  image_path?: string | null;
  category_image_path?: string | null;
  category_name?: string;
  updated_at?: Date;
  created_at?: Date;
};
