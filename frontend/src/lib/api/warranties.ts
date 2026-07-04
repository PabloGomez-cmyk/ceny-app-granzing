import { apiRequest } from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Warranty {
  id: string;
  tenant_id: string;
  quote_id: string;
  quote_line_id: string;
  product_id: string;
  product_snapshot: Record<string, unknown>;
  warranty_number: string;
  customer_snapshot: Record<string, unknown> | null;
  created_by_user_id: string;
  warranty_years: number;
  expires_at: string;
  is_valid: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface SendWarrantiesEmailPayload {
  recipient_email: string;
  recipient_name?: string | null;
  custom_message?: string | null;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const warrantiesApi = {
  list: (token: string) => apiRequest<Warranty[]>("/warranties", token),

  get: (id: string, token: string) => apiRequest<Warranty>(`/warranties/${id}`, token),

  listByQuote: (quoteId: string, token: string) =>
    apiRequest<Warranty[]>(`/quotes/${quoteId}/warranties`, token),

  generate: (quoteId: string, token: string) =>
    apiRequest<Warranty[]>(`/quotes/${quoteId}/warranties`, token, {
      method: "POST",
    }),

  sendEmail: (quoteId: string, token: string, payload: SendWarrantiesEmailPayload) =>
    apiRequest<void>(`/quotes/${quoteId}/warranties/send-email`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
