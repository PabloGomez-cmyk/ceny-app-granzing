import { apiRequest } from "./client";

export interface CustomerLabel {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

export interface Customer {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  label_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  neighborhood?: string | null;
  postal_code?: string | null;
  label_id?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  neighborhood?: string | null;
  postal_code?: string | null;
  label_id?: string | null;
  clear_label?: boolean;
  notes?: string | null;
  is_active?: boolean;
}

export interface CreateLabelInput {
  name: string;
  color: string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
}

export const customersApi = {
  list: (token: string) => apiRequest<Customer[]>("/customers", token),

  get: (token: string, id: string) =>
    apiRequest<Customer>(`/customers/${id}`, token),

  create: (token: string, data: CreateCustomerInput) =>
    apiRequest<Customer>("/customers", token, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: UpdateCustomerInput) =>
    apiRequest<Customer>(`/customers/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deactivate: (token: string, id: string) =>
    apiRequest<void>(`/customers/${id}`, token, { method: "DELETE" }),

  labels: {
    list: (token: string) =>
      apiRequest<CustomerLabel[]>("/customers/labels", token),

    create: (token: string, data: CreateLabelInput) =>
      apiRequest<CustomerLabel>("/customers/labels", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (token: string, id: string, data: UpdateLabelInput) =>
      apiRequest<CustomerLabel>(`/customers/labels/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (token: string, id: string) =>
      apiRequest<void>(`/customers/labels/${id}`, token, { method: "DELETE" }),
  },
};
