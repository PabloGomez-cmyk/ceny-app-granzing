import { apiRequest } from "./client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Brand {
  id: string;
  name: string;
  color: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface GlassType {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  brand_id: string;
  sale_price_per_m2: number;
  uv_percentage: number;
  irr_percentage: number;
  tser_percentage: number;
  warranty_years: number;
  category_id: string;
  roll_width_cm: number;
  roll_length_m: number;
  application_types: string[];
  compatible_glass_ids: string[];
  technical_sheet_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateBrandInput {
  name: string;
  color: string;
  logo_url?: string | null;
}

export interface UpdateBrandInput {
  name?: string;
  color?: string;
  logo_url?: string | null;
  clear_logo?: boolean;
}

export interface CreateCategoryInput {
  name: string;
}

export interface UpdateCategoryInput {
  name?: string;
}

export interface CreateGlassTypeInput {
  name: string;
}

export interface UpdateGlassTypeInput {
  name?: string;
}

export interface CreateProductInput {
  name: string;
  brand_id: string;
  sale_price_per_m2: number;
  uv_percentage: number;
  irr_percentage: number;
  tser_percentage: number;
  warranty_years: number;
  category_id: string;
  roll_width_cm: number;
  roll_length_m: number;
  application_types: string[];
  compatible_glass_ids: string[];
  technical_sheet_url?: string | null;
}

export interface UpdateProductInput {
  name?: string;
  brand_id?: string;
  sale_price_per_m2?: number;
  uv_percentage?: number;
  irr_percentage?: number;
  tser_percentage?: number;
  warranty_years?: number;
  category_id?: string;
  roll_width_cm?: number;
  roll_length_m?: number;
  application_types?: string[];
  compatible_glass_ids?: string[];
  technical_sheet_url?: string | null;
  clear_technical_sheet?: boolean;
  is_active?: boolean;
}

// ── API ────────────────────────────────────────────────────────────────────────

export const brandsApi = {
  list: (token: string) => apiRequest<Brand[]>("/brands", token),
  get: (token: string, id: string) => apiRequest<Brand>(`/brands/${id}`, token),
  create: (token: string, data: CreateBrandInput) =>
    apiRequest<Brand>("/brands", token, { method: "POST", body: JSON.stringify(data) }),
  update: (token: string, id: string, data: UpdateBrandInput) =>
    apiRequest<Brand>(`/brands/${id}`, token, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (token: string, id: string) =>
    apiRequest<void>(`/brands/${id}`, token, { method: "DELETE" }),
};

export const categoriesApi = {
  list: (token: string) => apiRequest<ProductCategory[]>("/categories", token),
  create: (token: string, data: CreateCategoryInput) =>
    apiRequest<ProductCategory>("/categories", token, { method: "POST", body: JSON.stringify(data) }),
  update: (token: string, id: string, data: UpdateCategoryInput) =>
    apiRequest<ProductCategory>(`/categories/${id}`, token, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (token: string, id: string) =>
    apiRequest<void>(`/categories/${id}`, token, { method: "DELETE" }),
};

export const glassTypesApi = {
  list: (token: string) => apiRequest<GlassType[]>("/glass-types", token),
  create: (token: string, data: CreateGlassTypeInput) =>
    apiRequest<GlassType>("/glass-types", token, { method: "POST", body: JSON.stringify(data) }),
  update: (token: string, id: string, data: UpdateGlassTypeInput) =>
    apiRequest<GlassType>(`/glass-types/${id}`, token, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (token: string, id: string) =>
    apiRequest<void>(`/glass-types/${id}`, token, { method: "DELETE" }),
};

export const productsApi = {
  list: (token: string) => apiRequest<Product[]>("/products", token),
  get: (token: string, id: string) => apiRequest<Product>(`/products/${id}`, token),
  create: (token: string, data: CreateProductInput) =>
    apiRequest<Product>("/products", token, { method: "POST", body: JSON.stringify(data) }),
  update: (token: string, id: string, data: UpdateProductInput) =>
    apiRequest<Product>(`/products/${id}`, token, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (token: string, id: string) =>
    apiRequest<void>(`/products/${id}`, token, { method: "DELETE" }),
};

export async function uploadImage(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/v1/uploads/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Error ${res.status}`);
  }
  const { url } = await res.json();
  return url as string;
}

export async function uploadDocument(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/v1/uploads/document`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Error ${res.status}`);
  }
  const { url } = await res.json();
  return url as string;
}
