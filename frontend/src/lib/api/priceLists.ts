import { apiRequest } from "./client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EffectivePriceItem {
  product_id: string;
  product_name: string;
  brand_name: string;
  catalog_purchase_price: number;
  catalog_sale_price: number;
  effective_purchase_price: number;
  effective_sale_price: number;
  has_purchase_override: boolean;
  has_sale_override: boolean;
  catalog_purchase_price_per_unit: number;
  catalog_sale_price_per_unit: number;
  effective_purchase_price_per_unit: number;
  effective_sale_price_per_unit: number;
  has_purchase_override_per_unit: boolean;
  has_sale_override_per_unit: boolean;
}

export interface SetPriceOverrideInput {
  product_id: string;
  purchase_price?: number | null;
  sale_price?: number | null;
  clear_purchase_price?: boolean;
  clear_sale_price?: boolean;
  purchase_price_per_unit?: number | null;
  sale_price_per_unit?: number | null;
  clear_purchase_price_per_unit?: boolean;
  clear_sale_price_per_unit?: boolean;
}

export interface PriceListItemResult {
  user_id: string;
  product_id: string;
  purchase_price: number | null;
  sale_price: number | null;
  purchase_price_per_unit: number | null;
  sale_price_per_unit: number | null;
}

// ── API ────────────────────────────────────────────────────────────────────────

export const priceListsApi = {
  getEffectiveList: (token: string, userId: string) =>
    apiRequest<EffectivePriceItem[]>(`/users/${userId}/price-list`, token),
  setOverride: (token: string, userId: string, data: SetPriceOverrideInput) =>
    apiRequest<PriceListItemResult>(`/price-lists/items/${userId}`, token, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteOverride: (token: string, userId: string, productId: string) =>
    apiRequest<void>(`/price-lists/items/${userId}/${productId}`, token, {
      method: "DELETE",
    }),
};
