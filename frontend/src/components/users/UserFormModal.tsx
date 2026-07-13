"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useCreateUser, useUpdateUser } from "@/hooks/useUsers";
import type { User } from "@/lib/api/users";

// ── Schemas ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  full_name: z.string().min(2, { error: "Nombre requerido" }),
  email: z.email({ error: "Email inválido" }),
  password: z.string().min(8, { error: "Mínimo 8 caracteres" }),
  role: z.enum(["ADMIN", "OPERATOR"]),
});

const editSchema = z.object({
  full_name: z.string().min(2, { error: "Nombre requerido" }),
  email: z.email({ error: "Email inválido" }),
  role: z.enum(["ADMIN", "OPERATOR"]),
});

const resetSchema = z.object({
  password: z.string().min(8, { error: "Mínimo 8 caracteres" }),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;
type ResetValues = z.infer<typeof resetSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModalMode = "create" | "edit" | "reset-password";

interface Props {
  mode: ModalMode;
  user?: User;
  onClose: () => void;
}

// ── Sub-forms ─────────────────────────────────────────────────────────────────

function CreateForm({ onClose }: { onClose: () => void }) {
  const { mutateAsync, isPending, error } = useCreateUser();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  async function onSubmit(values: CreateValues) {
    await mutateAsync(values);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
      <Field label="Nombre completo" error={errors.full_name?.message}>
        <input {...register("full_name")} placeholder="Juan Rodríguez" className={inputCls} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <input {...register("email")} type="email" placeholder="juan@glazing.ar" className={inputCls} />
      </Field>
      <Field label="Contraseña" error={errors.password?.message}>
        <input {...register("password")} type="password" placeholder="••••••••" className={inputCls} />
      </Field>
      <Field label="Rol" error={errors.role?.message}>
        <select {...register("role")} className={inputCls}>
          <option value="OPERATOR">Instalador (Operativo)</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </Field>
      {error && <p className="text-[12px] text-red-600">{error.message}</p>}
      <div className="mt-2 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={cancelBtn}>
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className={submitBtn}>
          {isPending ? "Creando..." : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}

function EditForm({ user, onClose }: { user: User; onClose: () => void }) {
  const { mutateAsync, isPending, error } = useUpdateUser();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditValues>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    reset({ full_name: user.full_name, email: user.email, role: user.role });
  }, [user, reset]);

  async function onSubmit(values: EditValues) {
    await mutateAsync({ id: user.id, data: values });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
      <Field label="Nombre completo" error={errors.full_name?.message}>
        <input {...register("full_name")} className={inputCls} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <input {...register("email")} type="email" className={inputCls} />
      </Field>
      <Field label="Rol" error={errors.role?.message}>
        <select {...register("role")} className={inputCls}>
          <option value="OPERATOR">Instalador (Operativo)</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </Field>
      {error && <p className="text-[12px] text-red-600">{error.message}</p>}
      <div className="mt-2 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={cancelBtn}>
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className={submitBtn}>
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onClose }: { user: User; onClose: () => void }) {
  const { mutateAsync, isPending, error } = useUpdateUser();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  async function onSubmit(values: ResetValues) {
    await mutateAsync({ id: user.id, data: { password: values.password } });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
      <p className="text-[13px] text-[#475569]">
        Establecé una nueva contraseña para <strong>{user.full_name}</strong>.
      </p>
      <Field label="Nueva contraseña" error={errors.password?.message}>
        <input {...register("password")} type="password" placeholder="••••••••" className={inputCls} />
      </Field>
      {error && <p className="text-[12px] text-red-600">{error.message}</p>}
      <div className="mt-2 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={cancelBtn}>
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className={submitBtn}>
          {isPending ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-[#475569]">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "h-[42px] w-full rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 text-[13px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none focus:ring-2 focus:ring-[#d9622c]/20";

const submitBtn =
  "rounded-[10px] bg-[#d9622c] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#b74e1e] disabled:opacity-60";

const cancelBtn =
  "rounded-[10px] border border-[#e2e6f0] px-5 py-2 text-[13px] font-medium text-[#475569] hover:bg-[#f8fafc]";

const TITLES: Record<ModalMode, string> = {
  create: "Nuevo usuario",
  edit: "Editar usuario",
  "reset-password": "Cambiar contraseña",
};

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function UserFormModal({ mode, user, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[440px] rounded-[18px] border border-[#e2e6f0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-6 py-4">
          <h2 className="font-bold text-[16px] text-[#0f172a]">{TITLES[mode]}</h2>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#475569]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6">
          {mode === "create" && <CreateForm onClose={onClose} />}
          {mode === "edit" && user && <EditForm user={user} onClose={onClose} />}
          {mode === "reset-password" && user && (
            <ResetPasswordForm user={user} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
