import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  brandsApi,
  categoriesApi,
  glassTypesApi,
  productsApi,
  type CreateBrandInput,
  type CreateCategoryInput,
  type CreateGlassTypeInput,
  type CreateProductInput,
  type UpdateBrandInput,
  type UpdateCategoryInput,
  type UpdateGlassTypeInput,
  type UpdateProductInput,
} from "@/lib/api/products";

function useToken(): string | undefined {
  const { data: session } = useSession();
  return session?.accessToken;
}

// ── Brands ────────────────────────────────────────────────────────────────────

export function useBrands() {
  const token = useToken();
  return useQuery({
    queryKey: ["brands"],
    queryFn: () => brandsApi.list(token!),
    enabled: !!token,
  });
}

export function useCreateBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBrandInput) => brandsApi.create(token!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });
}

export function useUpdateBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBrandInput }) =>
      brandsApi.update(token!, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });
}

export function useDeleteBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandsApi.delete(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

export function useCategories() {
  const token = useToken();
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(token!),
    enabled: !!token,
  });
}

export function useCreateCategory() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryInput) => categoriesApi.create(token!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) =>
      categoriesApi.update(token!, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

// ── Glass types ───────────────────────────────────────────────────────────────

export function useGlassTypes() {
  const token = useToken();
  return useQuery({
    queryKey: ["glass-types"],
    queryFn: () => glassTypesApi.list(token!),
    enabled: !!token,
  });
}

export function useCreateGlassType() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGlassTypeInput) => glassTypesApi.create(token!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["glass-types"] }),
  });
}

export function useUpdateGlassType() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGlassTypeInput }) =>
      glassTypesApi.update(token!, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["glass-types"] }),
  });
}

export function useDeleteGlassType() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => glassTypesApi.delete(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["glass-types"] }),
  });
}

// ── Products ──────────────────────────────────────────────────────────────────

export function useProducts() {
  const token = useToken();
  return useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(token!),
    enabled: !!token,
  });
}

export function useProduct(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["products", id],
    queryFn: () => productsApi.get(token!, id),
    enabled: !!token && !!id,
  });
}

export function useCreateProduct() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductInput) => productsApi.create(token!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductInput }) =>
      productsApi.update(token!, id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products", id] });
    },
  });
}

export function useDeleteProduct() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.delete(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}
