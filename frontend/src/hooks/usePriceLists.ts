import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { priceListsApi, type SetPriceOverrideInput } from "@/lib/api/priceLists";

function useToken(): string | undefined {
  const { data: session } = useSession();
  return session?.accessToken;
}

export function useEffectivePriceList(userId: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: ["price-list", userId],
    queryFn: () => priceListsApi.getEffectiveList(token!, userId!),
    enabled: !!token && !!userId,
  });
}

export function useSetPriceOverride() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: SetPriceOverrideInput }) =>
      priceListsApi.setOverride(token!, userId, data),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ["price-list", userId] });
    },
  });
}

export function useDeletePriceOverride() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, productId }: { userId: string; productId: string }) =>
      priceListsApi.deleteOverride(token!, userId, productId),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ["price-list", userId] });
    },
  });
}
