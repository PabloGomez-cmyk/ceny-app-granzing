import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usersApi, type CreateUserInput, type UpdateUserInput } from "@/lib/api/users";

function useToken(): string | undefined {
  const { data: session } = useSession();
  return (session as any)?.accessToken as string | undefined;
}

export function useUsers() {
  const token = useToken();
  return useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(token!),
    enabled: !!token,
  });
}

export function useUser(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => usersApi.get(token!, id),
    enabled: !!token && !!id,
  });
}

export function useCreateUser() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) => usersApi.create(token!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      usersApi.update(token!, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
