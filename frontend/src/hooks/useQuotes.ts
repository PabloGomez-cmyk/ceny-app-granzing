import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { type CreateQuoteInput, type QuoteStatus, quotesApi } from "@/lib/api/quotes";

function useToken(): string | undefined {
  const { data: session } = useSession();
  return session?.accessToken;
}

const KEYS = {
  all: ["quotes"] as const,
  detail: (id: string) => ["quotes", id] as const,
  stats: ["quotes", "stats"] as const,
};

export function useQuotes() {
  const token = useToken();
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () => quotesApi.list(token!),
    enabled: !!token,
  });
}

export function useQuoteStats() {
  const token = useToken();
  return useQuery({
    queryKey: KEYS.stats,
    queryFn: () => quotesApi.stats(token!),
    enabled: !!token,
  });
}

export function useQuote(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => quotesApi.get(id, token!),
    enabled: !!id && !!token,
  });
}

export function useCreateQuote() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuoteInput) => quotesApi.create(data, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateQuote() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateQuoteInput }) =>
      quotesApi.update(id, data, token!),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useUpdateQuoteStatus() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) =>
      quotesApi.updateStatus(id, status, token!),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useDeleteQuote() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotesApi.delete(id, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
