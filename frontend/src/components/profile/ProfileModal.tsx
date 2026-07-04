"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Lock, Building2, Check, Upload } from "lucide-react";
import { useSession } from "next-auth/react";
import { useUpdateUser, useUser } from "@/hooks/useUsers";
import { uploadImage } from "@/lib/api/products";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  userName: string | null;
  userEmail: string;
  onClose: () => void;
}

type Tab = "password" | "company";

// ── Schemas ───────────────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    password: z.string().min(8, { error: "Mínimo 8 caracteres" }),
    confirm: z.string().min(1, { error: "Confirmá la contraseña" }),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

const companySchema = z.object({
  companyName: z.string().min(1, { error: "Nombre de empresa requerido" }),
  logoUrl: z.string(),
  street: z.string(),
  city: z.string(),
  province: z.string(),
  postalCode: z.string(),
  cuit: z.string(),
});

type PasswordValues = z.infer<typeof passwordSchema>;
type CompanyValues = z.infer<typeof companySchema>;

// ── Shared input style ────────────────────────────────────────────────────────

const inputCls =
  "h-[42px] w-full rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-2 focus:ring-[#0f6e50]/20";

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

// ── Sección contraseña ────────────────────────────────────────────────────────

function PasswordSection({ userId }: { userId: string }) {
  const { mutateAsync, isPending, error } = useUpdateUser();
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  async function onSubmit(values: PasswordValues) {
    await mutateAsync({ id: userId, data: { password: values.password } });
    setSuccess(true);
    reset();
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-[13px] text-[#475569]">
        Establecé una nueva contraseña para tu cuenta.
      </p>
      <Field label="Nueva contraseña" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          placeholder="••••••••"
          className={inputCls}
        />
      </Field>
      <Field label="Confirmar contraseña" error={errors.confirm?.message}>
        <input
          {...register("confirm")}
          type="password"
          placeholder="••••••••"
          className={inputCls}
        />
      </Field>

      {error && <p className="text-[12px] text-red-600">{error.message}</p>}

      {success && (
        <div className="flex items-center gap-2 rounded-[8px] bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          <Check size={13} />
          Contraseña actualizada correctamente.
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 h-[42px] w-full rounded-[10px] bg-[#0f6e50] text-[13px] font-semibold text-white transition-colors hover:bg-[#0a5a40] disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}

// ── Sección empresa ───────────────────────────────────────────────────────────

function CompanySection({ userId }: { userId: string }) {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";
  const { data: userData } = useUser(userId);
  const { mutateAsync, isPending, error } = useUpdateUser();
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CompanyValues>({ resolver: zodResolver(companySchema) });

  const logoUrl = watch("logoUrl", "");

  useEffect(() => {
    if (userData) {
      reset({
        companyName: userData.company_name ?? "",
        logoUrl: userData.company_logo_url ?? "",
        street: userData.company_street ?? "",
        city: userData.company_city ?? "",
        province: userData.company_province ?? "",
        postalCode: userData.company_postal_code ?? "",
        cuit: userData.company_cuit ?? "",
      });
    }
  }, [userData, reset]);

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadImage(token, file);
      setValue("logoUrl", url, { shouldDirty: true });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al subir el logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(values: CompanyValues) {
    await mutateAsync({
      id: userId,
      data: {
        company_name: values.companyName || null,
        company_logo_url: values.logoUrl || null,
        company_street: values.street || null,
        company_city: values.city || null,
        company_province: values.province || null,
        company_postal_code: values.postalCode || null,
        company_cuit: values.cuit || null,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-[13px] text-[#475569]">
        Esta información aparecerá en los presupuestos que generes.
      </p>

      <Field label="Nombre de empresa" error={errors.companyName?.message}>
        <input
          {...register("companyName")}
          placeholder="Ej: Instalaciones Glazing Sur"
          className={inputCls}
        />
      </Field>

      {/* Logo upload */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-[#475569]">Logo de empresa</label>
        <div className="flex items-center gap-3">
          {/* Thumbnail actual */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#e2e6f0] bg-[#f8fafc]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo empresa"
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Building2 size={22} className="text-[#cbd5e1]" />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:bg-[#f1f5f9] disabled:opacity-60"
            >
              <Upload size={13} />
              {uploading ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setValue("logoUrl", "", { shouldDirty: true })}
                className="text-left text-[11px] text-red-500 hover:text-red-700"
              >
                Quitar logo
              </button>
            )}
            <p className="text-[10px] text-[#94a3b8]">PNG, JPG o WebP · Máx. 10 MB</p>
          </div>
        </div>

        {uploadError && <p className="text-[11px] text-red-600">{uploadError}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleLogoFile}
        />
      </div>

      {/* Dirección */}
      <Field label="Calle y número">
        <input {...register("street")} placeholder="Ej: Av. San Martín 1234" className={inputCls} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ciudad">
          <input {...register("city")} placeholder="Ej: Mendoza" className={inputCls} />
        </Field>
        <Field label="Provincia">
          <input {...register("province")} placeholder="Ej: Mendoza" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Código postal">
          <input {...register("postalCode")} placeholder="Ej: M5500" className={inputCls} />
        </Field>
        <Field label="CUIT">
          <input {...register("cuit")} placeholder="Ej: 30-12345678-9" className={inputCls} />
        </Field>
      </div>

      {error && <p className="text-[12px] text-red-600">{error.message}</p>}

      {saved && (
        <div className="flex items-center gap-2 rounded-[8px] bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          <Check size={13} />
          Datos de empresa guardados.
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || uploading}
        className="mt-1 h-[42px] w-full rounded-[10px] bg-[#0f6e50] text-[13px] font-semibold text-white transition-colors hover:bg-[#0a5a40] disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar empresa"}
      </button>
    </form>
  );
}

// ── Avatar helper ─────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// ── Modal principal ───────────────────────────────────────────────────────────

export default function ProfileModal({ userId, userName, userEmail, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("password");
  const displayName = userName ?? userEmail;
  const initials = getInitials(displayName);

  const tabs: { id: Tab; label: string; icon: typeof Lock }[] = [
    { id: "password", label: "Seguridad", icon: Lock },
    { id: "company", label: "Mi empresa", icon: Building2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#e2e6f0] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-6 py-4">
          <h2 className="font-bold text-[16px] text-[#0f172a]">Mi perfil</h2>
          <button
            onClick={onClose}
            className="text-[#94a3b8] transition-colors hover:text-[#475569]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Avatar + info */}
        <div className="flex items-center gap-4 bg-[#f8fafc] px-6 py-5">
          <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-[#0f6e50] text-[18px] font-bold text-white">
            {initials}
          </div>
          <div>
            {userName && (
              <p className="text-[15px] font-bold text-[#0f172a]">{userName}</p>
            )}
            <p className="text-[13px] text-[#94a3b8]">{userEmail}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#f1f5f9]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-[13px] font-medium transition-colors ${
                tab === id
                  ? "border-b-2 border-[#0f6e50] text-[#0f6e50]"
                  : "text-[#94a3b8] hover:text-[#475569]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {tab === "password" && <PasswordSection userId={userId} />}
          {tab === "company" && <CompanySection userId={userId} />}
        </div>
      </div>
    </div>
  );
}
