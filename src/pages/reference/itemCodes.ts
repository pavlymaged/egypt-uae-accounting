export interface ItemCode {
  code: number;
  name_en: string;
  name_ar: string | null;
  scope: 'site' | 'office';
  is_profession: boolean;
  is_asset: boolean;
  is_active: boolean;
}

export const ITEM_CODE_COLUMNS = 'code, name_en, name_ar, scope, is_profession, is_asset, is_active';
