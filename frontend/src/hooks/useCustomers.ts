import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  customersApi,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CreateLabelInput,
  type UpdateLabelInput,
} from "@/lib/api/customers";

function useToken(): string | undefined {
  const { data: session } = useSession();
  return session?.accessToken;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export function useCustomers() {
  const token = useToken();
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => customersApi.list(token!),
    enabled: !!token,
  });
}

export function useCustomer(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["customers", id],
    queryFn: () => customersApi.get(token!, id),
    enabled: !!token && !!id,
  });
}

export function useCreateCustomer() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerInput) => customersApi.create(token!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerInput }) =>
      customersApi.update(token!, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeactivateCustomer() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.deactivate(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

// ── Labels ────────────────────────────────────────────────────────────────────

export function useCustomerLabels() {
  const token = useToken();
  return useQuery({
    queryKey: ["customer-labels"],
    queryFn: () => customersApi.labels.list(token!),
    enabled: !!token,
  });
}

export function useCreateCustomerLabel() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLabelInput) => customersApi.labels.create(token!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-labels"] }),
  });
}

export function useUpdateCustomerLabel() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLabelInput }) =>
      customersApi.labels.update(token!, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-labels"] }),
  });
}

export function useDeleteCustomerLabel() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.labels.delete(token!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-labels"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
