"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { gmailApi, type SendQuoteEmailPayload } from "@/lib/api/gmail";

function useToken(): string {
  const { data: session } = useSession();
  return (session as any)?.accessToken as string ?? "";
}

export function useGmailStatus() {
  const token = useToken();
  return useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => gmailApi.getStatus(token),
    enabled: !!token,
    staleTime: 0,  // siempre refetch al montar — necesario post-callback OAuth
  });
}

export function useConnectGmail() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, redirectUri }: { code: string; redirectUri: string }) =>
      gmailApi.connect(token, code, redirectUri),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gmail-status"] }),
  });
}

export function useDisconnectGmail() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gmailApi.disconnect(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gmail-status"] }),
  });
}

export function useSendQuoteEmail() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      quoteId,
      payload,
    }: {
      quoteId: string;
      payload: SendQuoteEmailPayload;
    }) => gmailApi.sendQuoteEmail(token, quoteId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}
