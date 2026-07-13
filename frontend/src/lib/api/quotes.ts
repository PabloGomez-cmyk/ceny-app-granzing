import { apiRequest } from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "INVOICED" | "COMPLETED" | "CANCELLED";
export type FilmMode = "SINGLE" | "PER_GLASS";
export type LocationType = "SUPERFICIE" | "ALTURA";

export interface GlassPane {
  pane_id: string;
  glass_type_id: string | null;
  glass_type_name: string;
  width_cm: number;
  height_cm: number;
  location: LocationType;
  quantity: number;
  notes: string | null;
  sort_order: number;
  surface_m2: number;
}

export interface QuoteLine {
  line_id: string;
  product_id: string;
  product_snapshot: Record<string, unknown>;
  glass_pane_ids: string[];
  price_per_m2: number;
  surface_m2: number;
  subtotal: number;
}

export interface QuoteTotals {
  materials_subtotal: number | string;
  height_surcharge: number | string;
  travel_cost: number | string;
  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  total: number | string;
}

export interface Quote {
  id: string;
  tenant_id: string;
  created_by_user_id: string;
  quote_number: string;
  customer_id: string | null;
  customer_snapshot: Record<string, unknown> | null;
  status: QuoteStatus;
  film_mode: FilmMode;
  glass_panes: GlassPane[];
  lines: QuoteLine[];
  height_surcharge_pct: number;
  travel_cost: number;
  discount_pct: number;
  tax_pct: number;
  gap_cm: number;
  commercial_conditions: string;
  cut_plan_snapshot: Record<string, unknown>;
  valid_until: string;
  totals: QuoteTotals;
  total_margin: number | string | null;
  has_altura: boolean;
  created_at: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface GlassPaneInput {
  pane_id: string;
  glass_type_id: string | null;
  glass_type_name: string;
  width_cm: number;
  height_cm: number;
  location: LocationType;
  quantity: number;
  notes: string | null;
  sort_order: number;
}

export interface QuoteLineInput {
  product_id: string;
  product_snapshot: Record<string, unknown>;
  glass_pane_ids: string[];
  price_per_m2: number;
  surface_m2: number;
  subtotal: number;
}

export interface CreateQuoteInput {
  customer_id: string | null;
  customer_snapshot: Record<string, unknown> | null;
  film_mode: FilmMode;
  glass_panes: GlassPaneInput[];
  lines: QuoteLineInput[];
  height_surcharge_pct: number;
  travel_cost: number;
  discount_pct: number;
  tax_pct: number;
  gap_cm: number;
  commercial_conditions: string;
  cut_plan_snapshot: Record<string, unknown>;
  valid_until: string;
}

// ── Stats type ────────────────────────────────────────────────────────────────

export interface UserQuoteStat {
  user_id: string;
  total_quotes: number;
  quotes_this_month: number;
  conversion_rate: number;
  total_revenue: number;
  revenue_this_month: number;
}

export interface QuoteStats {
  quotes_this_month: number;
  total_quotes: number;
  conversion_rate: number;
  total_revenue: number;
  revenue_this_month: number;
  per_user: UserQuoteStat[];
}

// ── API ───────────────────────────────────────────────────────────────────────

export const quotesApi = {
  list: (token: string) => apiRequest<Quote[]>("/quotes", token),

  stats: (token: string) => apiRequest<QuoteStats>("/quotes/stats", token),

  get: (id: string, token: string) => apiRequest<Quote>(`/quotes/${id}`, token),

  create: (data: CreateQuoteInput, token: string) =>
    apiRequest<Quote>("/quotes", token, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: CreateQuoteInput, token: string) =>
    apiRequest<Quote>(`/quotes/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: string, status: QuoteStatus, token: string) =>
    apiRequest<Quote>(`/quotes/${id}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  delete: (id: string, token: string) =>
    apiRequest<void>(`/quotes/${id}`, token, { method: "DELETE" }),
};
