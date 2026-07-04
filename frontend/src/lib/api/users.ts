import { apiRequest } from "./client";

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: "ADMIN" | "OPERATOR";
  is_active: boolean;
  created_at: string;
  company_name: string | null;
  company_logo_url: string | null;
  company_street: string | null;
  company_city: string | null;
  company_province: string | null;
  company_postal_code: string | null;
  company_cuit: string | null;
  company_color_primary: string | null;
  company_color_secondary: string | null;
  default_commercial_conditions: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: "ADMIN" | "OPERATOR";
}

export interface UpdateUserInput {
  email?: string;
  full_name?: string;
  role?: "ADMIN" | "OPERATOR";
  is_active?: boolean;
  password?: string;
  company_name?: string | null;
  company_logo_url?: string | null;
  company_street?: string | null;
  company_city?: string | null;
  company_province?: string | null;
  company_postal_code?: string | null;
  company_cuit?: string | null;
  company_color_primary?: string | null;
  company_color_secondary?: string | null;
  default_commercial_conditions?: string | null;
}

export const usersApi = {
  list: (token: string) => apiRequest<User[]>("/users", token),

  get: (token: string, id: string) =>
    apiRequest<User>(`/users/${id}`, token),

  create: (token: string, data: CreateUserInput) =>
    apiRequest<User>("/users", token, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: UpdateUserInput) =>
    apiRequest<User>(`/users/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    apiRequest<void>(`/users/${id}`, token, { method: "DELETE" }),
};
