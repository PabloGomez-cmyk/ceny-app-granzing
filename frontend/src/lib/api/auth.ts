const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function publicRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = typeof body.detail === "string" ? body.detail : `Error ${res.status}`;
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  forgotPassword: (email: string) =>
    publicRequest<void>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  validateResetToken: (token: string) =>
    publicRequest<{ valid: boolean; email: string | null }>(
      `/auth/reset-password/validate?token=${encodeURIComponent(token)}`
    ),

  resetPassword: (token: string, newPassword: string) =>
    publicRequest<void>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
};
