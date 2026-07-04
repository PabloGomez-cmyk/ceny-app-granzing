import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { type SendWarrantiesEmailPayload, warrantiesApi } from "@/lib/api/warranties";

function useToken(): string | undefined {
  const { data: session } = useSession();
  return session?.accessToken;
}

const KEYS = {
  all: ["warranties"] as const,
  detail: (id: string) => ["warranties", id] as const,
  byQuote: (quoteId: string) => ["warranties", "quote", quoteId] as const,
};

export function useWarranties() {
  const token = useToken();
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () => warrantiesApi.list(token!),
    enabled: !!token,
  });
}

export function useWarranty(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => warrantiesApi.get(id, token!),
    enabled: !!id && !!token,
  });
}

export function useWarrantiesByQuote(quoteId: string) {
  const token = useToken();
  return useQuery({
    queryKey: KEYS.byQuote(quoteId),
    queryFn: () => warrantiesApi.listByQuote(quoteId, token!),
    enabled: !!quoteId && !!token,
  });
}

export function useGenerateWarranties() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => warrantiesApi.generate(quoteId, token!),
    onSuccess: (_, quoteId) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.byQuote(quoteId) });
    },
  });
}

export function useSendWarrantiesEmail() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      quoteId,
      payload,
    }: {
      quoteId: string;
      payload: SendWarrantiesEmailPayload;
    }) => warrantiesApi.sendEmail(quoteId, token!, payload),
    onSuccess: (_, { quoteId }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.byQuote(quoteId) });
    },
  });
}
