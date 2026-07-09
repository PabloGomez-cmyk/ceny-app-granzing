"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Lock,
  Building2,
  Mail,
  Check,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut,
  Plus,
  Search,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  Settings,
  Users,
} from "lucide-react";
import { useUpdateUser, useUser, useUsers, useDeleteUser } from "@/hooks/useUsers";
import { useQuoteStats } from "@/hooks/useQuotes";
import { useGmailStatus, useDisconnectGmail } from "@/hooks/useGmail";
import { uploadImage } from "@/lib/api/products";
import { gmailApi } from "@/lib/api/gmail";
import UserMenu from "@/components/layout/UserMenu";
import UserFormModal, { type ModalMode } from "@/components/users/UserFormModal";
import type { User } from "@/lib/api/users";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = "account" | "users";
type AccountTab = "security" | "company" | "email";

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
  colorPrimary: z.string(),
  colorSecondary: z.string(),
  defaultConditions: z.string(),
});

type PasswordValues = z.infer<typeof passwordSchema>;
type CompanyValues = z.infer<typeof companySchema>;

// ── Shared UI helpers ─────────────────────────────────────────────────────────

const inputCls =
  "h-[42px] w-full rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-2 focus:ring-[#d9622c]/20";

const btnPrimary =
  "h-[42px] w-full rounded-[10px] bg-[#d9622c] text-[13px] font-semibold text-white transition-colors hover:bg-[#b74e1e] disabled:opacity-60";

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

function SuccessBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
      <Check size={13} />
      {msg}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACCOUNT SECTIONS
// ═══════════════════════════════════════════════════════════════

function SecuritySection({ userId }: { userId: string }) {
  const { mutateAsync, isPending, error } = useUpdateUser();
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  async function onSubmit(values: PasswordValues) {
    await mutateAsync({ id: userId, data: { password: values.password } });
    setSuccess(true);
    reset();
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-[13px] text-[#475569]">Establecé una nueva contraseña para tu cuenta.</p>
      <Field label="Nueva contraseña" error={errors.password?.message}>
        <input {...register("password")} type="password" placeholder="••••••••" className={inputCls} />
      </Field>
      <Field label="Confirmar contraseña" error={errors.confirm?.message}>
        <input {...register("confirm")} type="password" placeholder="••••••••" className={inputCls} />
      </Field>
      {error && <p className="text-[12px] text-red-600">{error.message}</p>}
      {success && <SuccessBanner msg="Contraseña actualizada correctamente." />}
      <button type="submit" disabled={isPending} className={btnPrimary}>
        {isPending ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}

function CompanySection({ userId }: { userId: string }) {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";
  const { data: userData } = useUser(userId);
  const { mutateAsync, isPending, error } = useUpdateUser();
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<CompanyValues>({ resolver: zodResolver(companySchema) });

  const logoUrl = watch("logoUrl", "");
  const colorPrimary = watch("colorPrimary", "#d9622c");
  const colorSecondary = watch("colorSecondary", "#e8f5f0");

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
        colorPrimary: userData.company_color_primary ?? "#d9622c",
        colorSecondary: userData.company_color_secondary ?? "#e8f5f0",
        defaultConditions: userData.default_commercial_conditions ?? "",
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
    } catch (err) {
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
        company_color_primary: values.colorPrimary || null,
        company_color_secondary: values.colorSecondary || null,
        default_commercial_conditions: values.defaultConditions || null,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-[13px] text-[#475569]">Esta información aparecerá en los presupuestos que generes.</p>
      <Field label="Nombre de empresa" error={errors.companyName?.message}>
        <input {...register("companyName")} placeholder="Ej: Instalaciones Glazing Sur" className={inputCls} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-[#475569]">Logo de empresa</label>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#e2e6f0] bg-[#f8fafc]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 size={22} className="text-[#cbd5e1]" />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f1f5f9] disabled:opacity-60">
              <Upload size={13} />
              {uploading ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
            </button>
            {logoUrl && (
              <button type="button" onClick={() => setValue("logoUrl", "", { shouldDirty: true })}
                className="text-left text-[11px] text-red-500 hover:text-red-700">
                Quitar logo
              </button>
            )}
            <p className="text-[10px] text-[#94a3b8]">PNG, JPG o WebP · Máx. 10 MB</p>
          </div>
        </div>
        {uploadError && <p className="text-[11px] text-red-600">{uploadError}</p>}
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoFile} />
      </div>
      <Field label="Calle y número">
        <input {...register("street")} placeholder="Ej: Av. San Martín 1234" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ciudad"><input {...register("city")} placeholder="Ej: Mendoza" className={inputCls} /></Field>
        <Field label="Provincia"><input {...register("province")} placeholder="Ej: Mendoza" className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Código postal"><input {...register("postalCode")} placeholder="Ej: M5500" className={inputCls} /></Field>
        <Field label="CUIT"><input {...register("cuit")} placeholder="Ej: 30-12345678-9" className={inputCls} /></Field>
      </div>

      <div className="border-t border-[#f1f5f9] pt-4">
        <p className="mb-3 text-[12px] font-semibold text-[#475569]">Colores de marca</p>
        <p className="mb-3 text-[12px] text-[#94a3b8]">Estos colores se usan en los presupuestos PDF y en los emails enviados.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Color primario">
            <div className="flex items-center gap-2.5">
              <input type="color" value={colorPrimary}
                onChange={(e) => setValue("colorPrimary", e.target.value, { shouldDirty: true })}
                className="h-[42px] w-10 shrink-0 cursor-pointer rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-0.5" />
              <input {...register("colorPrimary")} placeholder="#d9622c" className={inputCls} />
            </div>
          </Field>
          <Field label="Color secundario">
            <div className="flex items-center gap-2.5">
              <input type="color" value={colorSecondary}
                onChange={(e) => setValue("colorSecondary", e.target.value, { shouldDirty: true })}
                className="h-[42px] w-10 shrink-0 cursor-pointer rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-0.5" />
              <input {...register("colorSecondary")} placeholder="#e8f5f0" className={inputCls} />
            </div>
          </Field>
        </div>
      </div>

      <div className="border-t border-[#f1f5f9] pt-4">
        <Field label="Condiciones comerciales predeterminadas">
          <textarea {...register("defaultConditions")} rows={4} placeholder="Ej: Validez del presupuesto: 30 días. Forma de pago: 50% anticipo, 50% contra entrega..."
            className="w-full rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-2.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-2 focus:ring-[#d9622c]/20 resize-none" />
          <p className="text-[11px] text-[#94a3b8]">Se pre-carga automáticamente en cada presupuesto nuevo.</p>
        </Field>
      </div>

      {error && <p className="text-[12px] text-red-600">{error.message}</p>}
      {saved && <SuccessBanner msg="Datos de empresa guardados." />}
      <button type="submit" disabled={isPending || uploading} className={btnPrimary}>
        {isPending ? "Guardando..." : "Guardar empresa"}
      </button>
    </form>
  );
}

function EmailSection() {
  const { data: session } = useSession();
  const token = session?.accessToken ?? "";
  const { data: status, isLoading } = useGmailStatus();
  const { mutateAsync: disconnect, isPending: disconnecting } = useDisconnectGmail();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!token) return;
    setConnecting(true);
    setError(null);
    try {
      const callbackUrl = `${window.location.origin}/settings/gmail/callback`;
      const result = await gmailApi.getAuthUrl(token, callbackUrl);
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar conexión con Gmail");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      await disconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al desconectar Gmail");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-[#475569]">
        Conectá tu cuenta de Gmail para enviar presupuestos directamente desde la aplicación.
      </p>
      <div className="rounded-[12px] border border-[#e2e6f0] p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Estado de la cuenta</p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#94a3b8]">
            <Loader2 size={14} className="animate-spin" /> Verificando...
          </div>
        ) : status?.connected ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
              <div>
                <p className="text-[13px] font-semibold text-[#0f172a]">Gmail conectado</p>
                <p className="text-[12px] text-[#94a3b8]">{status.gmail_email}</p>
              </div>
            </div>
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="flex items-center gap-1.5 rounded-[8px] border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-60">
              <LogOut size={12} />
              {disconnecting ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <XCircle size={18} className="shrink-0 text-[#94a3b8]" />
            <p className="text-[13px] text-[#475569]">No hay ninguna cuenta conectada</p>
          </div>
        )}
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {!status?.connected && (
        <button onClick={handleConnect} disabled={connecting || isLoading}
          className="flex h-[44px] w-full items-center justify-center gap-2.5 rounded-[10px] border border-[#d9622c] bg-white text-[13px] font-semibold text-[#d9622c] hover:bg-[#fbeee1] disabled:opacity-60">
          {connecting ? <Loader2 size={15} className="animate-spin" /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {connecting ? "Redirigiendo a Google..." : "Conectar con Gmail"}
        </button>
      )}
      <div className="rounded-[10px] bg-[#f8fafc] p-4 text-[12px] text-[#64748b]">
        <p className="mb-1 font-semibold text-[#475569]">¿Para qué se usa?</p>
        <ul className="ml-3 list-disc space-y-1">
          <li>Enviar presupuestos a tus clientes desde tu dirección de Gmail</li>
          <li>Los correos se envían en tu nombre — tu cliente responde directo a vos</li>
          <li>Solo solicitamos permiso para <strong>enviar</strong> emails, no para leer tu bandeja</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USERS SECTION (Admin only)
// ═══════════════════════════════════════════════════════════════

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const AVATAR_PALETTE = [
  "#d9622c", "#2563eb", "#7c3aed", "#dc2626", "#d97706",
  "#0891b2", "#059669", "#9333ea", "#be185d", "#1d4ed8",
];

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size <= 32 ? 11 : 13 }}
    >
      {getInitials(name)}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
      active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function UsersSection() {
  const { data: users = [], isLoading, error } = useUsers();
  const { data: quoteStats } = useQuoteStats();
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();

  const [filter, setFilter] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: ModalMode; user?: User } | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchFilter = filter === "all" || u.is_active;
      const q = search.toLowerCase();
      return matchFilter && (!q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    });
  }, [users, filter, search]);

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;
  const activeCount = users.filter((u) => u.is_active).length;

  function handleToggleActive(user: User) {
    if (user.is_active) deleteUser(user.id);
    else updateUser({ id: user.id, data: { is_active: true } });
    setSelectedId(null);
  }

  return (
    <div className="flex-1 p-5">
      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: activeCount, label: "Usuarios activos", sub: `de ${users.length} registrados` },
          { value: quoteStats ? quoteStats.quotes_this_month : "—", label: "Presupuestos mes", sub: quoteStats ? `${quoteStats.total_quotes} en total` : "cargando..." },
          { value: quoteStats ? `${quoteStats.conversion_rate}%` : "—", label: "Conv. promedio", sub: "aceptados / no cancelados" },
          { value: "—", label: "Región top", sub: "próximamente", accent: true },
        ].map((s) => (
          <div key={s.label} className={`rounded-[12px] border bg-white p-4 ${s.accent ? "border-l-4 border-l-amber-400 border-[#e8ecf2]" : "border-[#e8ecf2]"}`}>
            <p className={`font-bold text-[28px] leading-none ${s.accent ? "text-amber-500" : "text-[#0f172a]"}`}>{s.value}</p>
            <p className="mt-1 text-[13px] font-semibold text-[#374151]">{s.label}</p>
            <p className="text-[11px] text-[#94a3b8]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e]">
          <Plus size={14} />
          <span className="hidden sm:inline">Nuevo usuario</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
        <div className="relative flex-1 sm:max-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuario..."
            className="h-[36px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] pl-8 pr-3 text-[13px] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20 placeholder:text-[#94a3b8]" />
        </div>
        <div className="flex overflow-hidden rounded-[10px] border border-[#dde4ee] bg-[#f8fafc]">
          {(["active", "all"] as const).map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 text-[12px] font-medium transition-colors ${filter === tab ? "bg-[#d9622c] text-white" : "text-[#475569] hover:bg-[#f1f5f9]"}`}>
              {tab === "active" ? "Activos" : "Todos"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-[#94a3b8]">
          {filtered.length} usuario{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading && <p className="py-12 text-center text-[13px] text-[#94a3b8]">Cargando usuarios...</p>}
      {error && <p className="py-12 text-center text-[13px] text-red-500">{error.message}</p>}

      {/* Tabla desktop */}
      {!isLoading && !error && (
        <div className="hidden overflow-hidden rounded-[12px] border border-[#e8ecf2] bg-white lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                {["Usuario", "Email", "Región", "Presupuestos", "Conversión", "Lista precios", "Estado", "Acciones"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-[13px] text-[#94a3b8]">Sin usuarios{filter === "active" ? " activos" : ""}.</td></tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} onClick={() => setSelectedId((p) => p === user.id ? null : user.id)}
                    className={`cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafb] ${selectedId === user.id ? "bg-[#fbeee1]" : ""}`}>
                    <td className="py-3 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.full_name} size={36} />
                        <div>
                          <p className="text-[13px] font-semibold text-[#0f172a]">{user.full_name}</p>
                          <p className="text-[11px] text-[#94a3b8]">{user.role === "ADMIN" ? "Admin" : "Instalador"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[13px] text-[#475569]">{user.email}</td>
                    {["—", "—", "—", "—"].map((v, i) => (
                      <td key={i} className="px-3 py-3 text-[13px] text-[#94a3b8]">{v}</td>
                    ))}
                    <td className="px-3 py-3"><StatusBadge active={user.is_active} /></td>
                    <td className="py-3 pl-3 pr-5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setModal({ mode: "edit", user })}
                        className="rounded-[8px] border border-[#e2e6f0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f1f5f9]">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Detail panel */}
          {selectedUser && (
            <div className="border-t border-[#e8ecf2] bg-white px-6 py-4">
              <p className="mb-3 text-[12px] font-semibold text-[#94a3b8]">Detalle — {selectedUser.full_name}</p>
              <div className="flex flex-wrap items-center gap-8">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedUser.full_name} size={44} />
                  <div>
                    <p className="text-[14px] font-bold text-[#0f172a]">{selectedUser.full_name}</p>
                    <p className="text-[12px] text-[#94a3b8]">{selectedUser.role === "ADMIN" ? "Admin" : "Instalador"}</p>
                    <p className="text-[12px] text-[#94a3b8]">{selectedUser.email}</p>
                  </div>
                </div>
                {[["Presup. mes", "—"], ["Aceptados", "—"], ["Conversión", "—"], ["Facturado", "—"]].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-[18px] font-bold text-[#0f172a]">{v}</p>
                    <p className="text-[11px] text-[#94a3b8]">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => setModal({ mode: "edit", user: selectedUser })}
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e]">
                  <Pencil size={13} /> Editar usuario
                </button>
                <button onClick={() => setModal({ mode: "reset-password", user: selectedUser })}
                  className="flex items-center gap-1.5 rounded-[10px] border border-[#e2e6f0] px-4 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#f1f5f9]">
                  <KeyRound size={13} /> Reset password
                </button>
                <button onClick={() => handleToggleActive(selectedUser)} disabled={isDeleting || isUpdating}
                  className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[12px] font-medium disabled:opacity-60 ${
                    selectedUser.is_active
                      ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}>
                  {selectedUser.is_active ? <><UserX size={13} /> Desactivar</> : <><UserCheck size={13} /> Reactivar</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards mobile */}
      {!isLoading && !error && (
        <div className="flex flex-col gap-3 lg:hidden">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[#94a3b8]">Sin usuarios{filter === "active" ? " activos" : ""}.</p>
          ) : (
            filtered.map((user) => (
              <div key={user.id} className="rounded-[12px] border border-[#e8ecf2] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.full_name} size={40} />
                    <div>
                      <p className="text-[13px] font-semibold text-[#0f172a]">{user.full_name}</p>
                      <p className="text-[11px] text-[#94a3b8]">{user.role === "ADMIN" ? "Admin" : "Instalador"}</p>
                      <p className="text-[11px] text-[#94a3b8]">{user.email}</p>
                    </div>
                  </div>
                  <StatusBadge active={user.is_active} />
                </div>
                <div className="mt-3 flex justify-end border-t border-[#f1f5f9] pt-3">
                  <button onClick={() => setModal({ mode: "edit", user })}
                    className="rounded-[8px] border border-[#e2e6f0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f1f5f9]">
                    Editar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {modal && <UserFormModal mode={modal.mode} user={modal.user} onClose={() => setModal(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [section, setSection] = useState<Section>("account");
  const [tab, setTab] = useState<AccountTab>("security");

  const userId = session?.userId;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const role = session?.role;
  const isAdmin = role === "ADMIN";

  const accountTabs: { id: AccountTab; label: string; icon: typeof Lock }[] = [
    { id: "security", label: "Seguridad", icon: Lock },
    { id: "company", label: "Mi empresa", icon: Building2 },
    { id: "email", label: "Correo", icon: Mail },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-[#e4eaf2] bg-white px-5 py-2.5">
        {/* Left: logo + breadcrumb */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white">
              <Image src="/logo.png" alt="Intermedios" width={26} height={26} className="object-contain" />
            </div>
            <span className="hidden text-[15px] font-semibold text-[#1a1a2e] sm:inline">
              Intermedios
            </span>
          </Link>
          <span className="text-[#cbd5e1]">/</span>
          <span className="text-[14px] font-semibold text-[#0f172a]">
            {isAdmin && section === "users" ? "Usuarios" : "Ajustes"}
          </span>
        </div>

        {/* Center: section switcher (Admin only) */}
        {isAdmin && (
          <div className="flex items-center overflow-hidden rounded-[10px] border border-[#e2e6f0] bg-[#f8fafc]">
            <button
              onClick={() => setSection("account")}
              className={`flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium transition-colors ${
                section === "account"
                  ? "bg-[#d9622c] text-white"
                  : "text-[#475569] hover:bg-[#f1f5f9]"
              }`}
            >
              <Settings size={13} />
              <span className="hidden sm:inline">Mi cuenta</span>
            </button>
            <button
              onClick={() => setSection("users")}
              className={`flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium transition-colors ${
                section === "users"
                  ? "bg-[#d9622c] text-white"
                  : "text-[#475569] hover:bg-[#f1f5f9]"
              }`}
            >
              <Users size={13} />
              <span className="hidden sm:inline">Usuarios</span>
            </button>
          </div>
        )}

        {/* Right: user menu */}
        <UserMenu name={name} email={email} role={role} onOpenProfile={() => {}} />
      </header>

      {/* ── Account section ───────────────────────────────────────────────── */}
      {section === "account" && (
        <main className="mx-auto w-full max-w-2xl px-4 py-8">
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-1.5 text-[13px] text-[#64748b] hover:text-[#0f172a]"
          >
            <ArrowLeft size={14} />
            Volver
          </button>

          <div className="overflow-hidden rounded-[20px] border border-[#e2e6f0] bg-white shadow-sm">
            <div className="border-b border-[#f1f5f9] px-6 py-5">
              <h1 className="text-[18px] font-bold text-[#0f172a]">Ajustes de cuenta</h1>
              <p className="mt-1 text-[13px] text-[#94a3b8]">{email}</p>
            </div>

            <div className="flex border-b border-[#f1f5f9]">
              {accountTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex flex-1 items-center justify-center gap-2 py-3.5 text-[13px] font-medium transition-colors ${
                    tab === id
                      ? "border-b-2 border-[#d9622c] text-[#d9622c]"
                      : "text-[#94a3b8] hover:text-[#475569]"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            <div className="px-6 py-6">
              {tab === "security" && userId && <SecuritySection userId={userId} />}
              {tab === "company" && userId && <CompanySection userId={userId} />}
              {tab === "email" && <EmailSection />}
            </div>
          </div>
        </main>
      )}

      {/* ── Users section ─────────────────────────────────────────────────── */}
      {section === "users" && isAdmin && <UsersSection />}
    </div>
  );
}
