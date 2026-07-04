import { apiRequest } from "./client";

export interface GmailStatus {
  connected: boolean;
  gmail_email: string | null;
}

export interface GmailAuthUrl {
  url: string;
}

export interface SendQuoteEmailPayload {
  recipient_email: string;
  recipient_name?: string | null;
  custom_message?: string | null;
  pdf_base64?: string | null;
}

export const gmailApi = {
  getStatus: (token: string) =>
    apiRequest<GmailStatus>("/settings/gmail/status", token),

  getAuthUrl: (token: string, redirectUri: string) =>
    apiRequest<GmailAuthUrl>(
      `/settings/gmail/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`,
      token
    ),

  connect: (token: string, code: string, redirectUri: string) =>
    apiRequest<GmailStatus>("/settings/gmail/connect", token, {
      method: "POST",
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    }),

  disconnect: (token: string) =>
    apiRequest<void>("/settings/gmail/disconnect", token, { method: "DELETE" }),

  sendQuoteEmail: (token: string, quoteId: string, payload: SendQuoteEmailPayload) =>
    apiRequest<void>(`/quotes/${quoteId}/send-email`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
