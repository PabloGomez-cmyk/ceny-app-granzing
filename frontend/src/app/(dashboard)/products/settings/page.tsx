"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Pencil,
  X,
  Upload,
  Layers,
  Tag,
  Droplets,
} from "lucide-react";
import {
  useBrands,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useGlassTypes,
  useCreateGlassType,
  useUpdateGlassType,
  useDeleteGlassType,
} from "@/hooks/useProducts";
import { uploadImage } from "@/lib/api/products";
import UserMenu from "@/components/layout/UserMenu";
import ProfileModal from "@/components/profile/ProfileModal";
import type { Brand, ProductCategory, GlassType } from "@/lib/api/products";

// ── Paleta ────────────────────────────────────────────────────────────────────

const PALETTE = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#a855f7",
  "#d9622c", "#1e40af", "#9f1239", "#92400e",
];

// ── ColorPicker ───────────────────────────────────────────────────────────────

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [custom, setCustom] = useState(color);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const popover = document.getElementById("cp-popover");
      if (popover && !popover.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current!.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="Cambiar color"
        className="h-6 w-6 shrink-0 rounded-[5px] border-2 border-white shadow ring-1 ring-black/10 transition-transform hover:scale-110"
        style={{ background: color }}
      />
      {open && pos && (
        <div
          id="cp-popover"
          className="fixed z-[9999] rounded-[12px] border border-[#e8ecf2] bg-white p-3 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-8 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className="relative flex h-6 w-6 items-center justify-center rounded-[4px] transition-transform hover:scale-110"
                style={{ background: c }}
              >
                {color === c && <Check size={11} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border-0 p-0"
            />
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={7}
              className="flex-1 rounded-[6px] border border-[#dde4ee] px-2 py-0.5 text-[12px] font-mono"
            />
            <button
              type="button"
              onClick={() => { onChange(custom); setOpen(false); }}
              className="rounded-[6px] bg-[#d9622c] px-2 py-0.5 text-[11px] font-semibold text-white"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── BrandRow ──────────────────────────────────────────────────────────────────

function BrandRow({
  brand,
  token,
  onSave,
  onDelete,
}: {
  brand: Brand;
  token: string;
  onSave: (id: string, data: { name?: string; color?: string; logo_url?: string | null }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);
  const [color, setColor] = useState(brand.color);
  const [logoUrl, setLogoUrl] = useState<string | null>(brand.logo_url);
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function handleSave() {
    if (!name.trim()) { setName(brand.name); setEditing(false); return; }
    onSave(brand.id, { name: name.trim(), color, logo_url: logoUrl });
    setEditing(false);
  }

  function handleCancel() {
    setName(brand.name);
    setColor(brand.color);
    setLogoUrl(brand.logo_url);
    setEditing(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(token, file);
      setLogoUrl(url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-[#f1f5f9] bg-[#fbeee1]">
        <td className="py-3 pl-5 pr-3">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <div className="relative h-8 w-8 shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover shadow" />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white shadow"
                  style={{ background: color }}
                >
                  {name.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d9622c] text-white shadow"
              >
                {uploading ? <span className="text-[8px]">…</span> : <Upload size={8} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            {/* Nombre */}
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
              maxLength={100}
              className="flex-1 rounded-[6px] border border-[#d9622c] bg-white px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/30"
            />
          </div>
        </td>
        <td className="px-3 py-3">
          <ColorPicker color={color} onChange={setColor} />
        </td>
        <td className="w-48 py-3 pl-3 pr-5">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 rounded-[6px] border border-[#dde4ee] bg-white px-2 py-1 text-[11px] text-[#64748b] hover:border-[#d9622c]/40 hover:text-[#d9622c] disabled:opacity-50"
            >
              <Upload size={11} />
              {uploading ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl(null)}
                className="rounded-[6px] px-2 py-1 text-[11px] text-red-400 hover:bg-red-50"
              >
                Quitar
              </button>
            )}
            <button
              onClick={handleSave}
              className="rounded-[6px] bg-[#d9622c] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#b74e1e]"
            >
              Guardar
            </button>
            <button onClick={handleCancel} className="text-[18px] leading-none text-[#94a3b8] hover:text-[#374151]">
              ×
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafb]">
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-2.5">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="h-7 w-7 rounded-full object-cover shadow" />
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white shadow"
              style={{ background: brand.color }}
            >
              {brand.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[13px] text-[#0f172a]">{brand.name}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="h-5 w-5 rounded-[4px] shadow-sm ring-1 ring-black/10" style={{ background: brand.color }} />
      </td>
      <td className="w-28 py-3 pl-3 pr-5">
        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setEditing(true)}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#64748b] hover:bg-[#fbeee1] hover:text-[#d9622c]"
          >
            <Pencil size={13} />
          </button>
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(brand.id)} className="rounded-[6px] bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-600">Eliminar</button>
              <button onClick={() => setConfirmDel(false)} className="rounded-[6px] px-2 py-0.5 text-[11px] text-[#64748b] hover:bg-[#f1f5f9]">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#cbd5e1] hover:bg-red-50 hover:text-red-400">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── NewBrandRow ───────────────────────────────────────────────────────────────

function NewBrandRow({
  token,
  onSave,
  onCancel,
  isSaving,
}: {
  token: string;
  onSave: (name: string, color: string, logo_url: string | null) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(token, file);
      setLogoUrl(url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleSave() {
    if (!name.trim()) { onCancel(); return; }
    onSave(name.trim(), color, logoUrl);
  }

  return (
    <tr className="border-b border-[#f1f5f9] bg-[#fbeee1]">
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-2">
          {/* Preview avatar */}
          <div
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[12px] font-bold text-white shadow"
            style={{ background: color }}
            title="El color del avatar se actualiza con el selector de color"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase() || "?"
            )}
          </div>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
            placeholder="Nombre de la marca..."
            maxLength={100}
            className="flex-1 rounded-[6px] border border-[#d9622c] bg-white px-2 py-1 text-[13px] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/30"
          />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
      </td>
      <td className="px-3 py-3">
        <ColorPicker color={color} onChange={setColor} />
      </td>
      <td className="w-48 py-3 pl-3 pr-5">
        <div className="flex items-center justify-end gap-2">
          {/* Logo upload */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 rounded-[6px] border border-[#dde4ee] bg-white px-2 py-1 text-[11px] text-[#64748b] hover:border-[#d9622c]/40 hover:text-[#d9622c] disabled:opacity-50"
          >
            <Upload size={11} />
            {uploading ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="rounded-[6px] bg-[#d9622c] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
          >
            {isSaving ? "..." : "Guardar"}
          </button>
          <button onClick={onCancel} className="text-[18px] leading-none text-[#94a3b8] hover:text-[#374151]">×</button>
        </div>
      </td>
    </tr>
  );
}

// ── SimpleRow (categorías y vidrios) ──────────────────────────────────────────

function SimpleRow({
  item,
  onSave,
  onDelete,
}: {
  item: ProductCategory | GlassType;
  onSave: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [confirmDel, setConfirmDel] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function handleSave() {
    if (!name.trim()) { setName(item.name); setEditing(false); return; }
    onSave(item.id, name.trim());
    setEditing(false);
  }

  return (
    <tr
      className={`group border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafb] ${editing ? "bg-[#fbeee1]" : ""}`}
      onClick={() => !editing && setEditing(true)}
    >
      <td className="py-3 pl-5 pr-3">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setName(item.name); setEditing(false); } }}
            onBlur={handleSave}
            maxLength={100}
            className="w-full max-w-[400px] rounded-[6px] border border-[#d9622c] bg-white px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/30"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="cursor-text text-[13px] text-[#0f172a]">{item.name}</span>
        )}
      </td>
      <td className="w-24 py-3 pl-3 pr-5" onClick={(e) => e.stopPropagation()}>
        {confirmDel ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => onDelete(item.id)} className="rounded-[6px] bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">Eliminar</button>
            <button onClick={() => setConfirmDel(false)} className="rounded-[6px] px-2 py-0.5 text-[11px] text-[#64748b] hover:bg-[#f1f5f9]">No</button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#64748b] hover:bg-[#fbeee1] hover:text-[#d9622c]"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#cbd5e1] hover:bg-red-50 hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function NewSimpleRow({
  placeholder,
  onSave,
  onCancel,
  isSaving,
}: {
  placeholder: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <tr className="border-b border-[#f1f5f9] bg-[#fbeee1]">
      <td className="py-3 pl-5 pr-3">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); if (e.key === "Escape") onCancel(); }}
          placeholder={placeholder}
          maxLength={100}
          className="w-full max-w-[400px] rounded-[6px] border border-[#d9622c] bg-white px-2 py-1 text-[13px] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/30"
        />
      </td>
      <td className="py-3 pl-3 pr-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim() || isSaving}
            className="rounded-[6px] bg-[#d9622c] px-2.5 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? "..." : "Guardar"}
          </button>
          <button onClick={onCancel} className="text-[11px] text-[#94a3b8] hover:text-[#374151]">×</button>
        </div>
      </td>
    </tr>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#e8ecf2] bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#f1f5f9] px-5 py-3">
        <Icon size={15} className="text-[#d9622c]" />
        <span className="text-[14px] font-semibold text-[#0f172a]">{title}</span>
        <span className="ml-1 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-medium text-[#64748b]">{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = session?.role;
  const token = session?.accessToken;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const userId = session?.userId;
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (role && role !== "ADMIN") router.replace("/products");
  }, [role, router]);

  const { data: brands = [], isLoading: loadingBrands } = useBrands();
  const { data: categories = [], isLoading: loadingCats } = useCategories();
  const { data: glassTypes = [], isLoading: loadingGlass } = useGlassTypes();

  const { mutate: createBrand, isPending: creatingBrand } = useCreateBrand();
  const { mutate: updateBrand } = useUpdateBrand();
  const { mutate: deleteBrand } = useDeleteBrand();

  const { mutate: createCategory, isPending: creatingCat } = useCreateCategory();
  const { mutate: updateCategory } = useUpdateCategory();
  const { mutate: deleteCategory } = useDeleteCategory();

  const { mutate: createGlassType, isPending: creatingGlass } = useCreateGlassType();
  const { mutate: updateGlassType } = useUpdateGlassType();
  const { mutate: deleteGlassType } = useDeleteGlassType();

  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [showNewGlass, setShowNewGlass] = useState(false);

  const activeBrands = brands.filter((b) => b.is_active);
  const activeCats = categories.filter((c) => c.is_active);
  const activeGlass = glassTypes.filter((g) => g.is_active);

  const handleSaveBrand = useCallback((id: string, data: { name?: string; color?: string; logo_url?: string | null }) => {
    updateBrand({ id, data });
  }, [updateBrand]);

  const handleDeleteBrand = useCallback((id: string) => {
    deleteBrand(id);
  }, [deleteBrand]);

  if (!token) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between bg-[#d9622c] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2 text-white">
            <Link href="/products" className="text-[14px] font-medium text-white/70 hover:text-white">
              Catálogo
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-[14px] font-bold">Configuración</span>
          </div>
        </div>
        <UserMenu
          name={name}
          email={email}
          role={role}
          onOpenProfile={() => setProfileOpen(true)}
          variant="dark"
        />
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-6 p-5">

        {/* ── Marcas ──────────────────────────────────────────────────────── */}
        <Section title="Marcas" icon={Layers} count={activeBrands.length}>
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] px-5 py-2.5">
            <button
              onClick={() => setShowNewBrand(true)}
              disabled={showNewBrand}
              className="flex items-center gap-1.5 rounded-[8px] bg-[#d9622c] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
            >
              <Plus size={13} />
              Nueva marca
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Marca</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Color</th>
                <th className="py-2.5 pl-3 pr-5" />
              </tr>
            </thead>
            <tbody>
              {showNewBrand && (
                <NewBrandRow
                  token={token}
                  onSave={(n, c, l) => createBrand({ name: n, color: c, logo_url: l }, { onSuccess: () => setShowNewBrand(false) })}
                  onCancel={() => setShowNewBrand(false)}
                  isSaving={creatingBrand}
                />
              )}
              {loadingBrands ? (
                <tr><td colSpan={3} className="py-10 text-center text-[13px] text-[#94a3b8]">Cargando...</td></tr>
              ) : activeBrands.length === 0 && !showNewBrand ? (
                <tr><td colSpan={3} className="py-10 text-center text-[13px] text-[#94a3b8]">No hay marcas. Creá la primera.</td></tr>
              ) : (
                activeBrands.map((b) => (
                  <BrandRow key={b.id} brand={b} token={token} onSave={handleSaveBrand} onDelete={handleDeleteBrand} />
                ))
              )}
            </tbody>
          </table>
        </Section>

        {/* ── Categorías ──────────────────────────────────────────────────── */}
        <Section title="Categorías de producto" icon={Tag} count={activeCats.length}>
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] px-5 py-2.5">
            <button
              onClick={() => setShowNewCat(true)}
              disabled={showNewCat}
              className="flex items-center gap-1.5 rounded-[8px] bg-[#d9622c] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
            >
              <Plus size={13} />
              Nueva categoría
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Nombre</th>
                <th className="py-2.5 pl-3 pr-5" />
              </tr>
            </thead>
            <tbody>
              {showNewCat && (
                <NewSimpleRow
                  placeholder="Nombre de la categoría..."
                  onSave={(n) => createCategory({ name: n }, { onSuccess: () => setShowNewCat(false) })}
                  onCancel={() => setShowNewCat(false)}
                  isSaving={creatingCat}
                />
              )}
              {loadingCats ? (
                <tr><td colSpan={2} className="py-10 text-center text-[13px] text-[#94a3b8]">Cargando...</td></tr>
              ) : activeCats.length === 0 && !showNewCat ? (
                <tr><td colSpan={2} className="py-10 text-center text-[13px] text-[#94a3b8]">No hay categorías. Hacé clic en fila para editar.</td></tr>
              ) : (
                activeCats.map((c) => (
                  <SimpleRow
                    key={c.id}
                    item={c}
                    onSave={(id, name) => updateCategory({ id, data: { name } })}
                    onDelete={(id) => deleteCategory(id)}
                  />
                ))
              )}
            </tbody>
          </table>
          {!loadingCats && activeCats.length > 0 && (
            <p className="px-5 pb-3 text-[11px] text-[#94a3b8]">Clic en una fila para editar · Enter para guardar · Esc para cancelar</p>
          )}
        </Section>

        {/* ── Tipos de vidrio ─────────────────────────────────────────────── */}
        <Section title="Tipos de vidrio" icon={Droplets} count={activeGlass.length}>
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] px-5 py-2.5">
            <button
              onClick={() => setShowNewGlass(true)}
              disabled={showNewGlass}
              className="flex items-center gap-1.5 rounded-[8px] bg-[#d9622c] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
            >
              <Plus size={13} />
              Nuevo tipo
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Nombre</th>
                <th className="py-2.5 pl-3 pr-5" />
              </tr>
            </thead>
            <tbody>
              {showNewGlass && (
                <NewSimpleRow
                  placeholder="ej: Monolítico, DVH, Templado..."
                  onSave={(n) => createGlassType({ name: n }, { onSuccess: () => setShowNewGlass(false) })}
                  onCancel={() => setShowNewGlass(false)}
                  isSaving={creatingGlass}
                />
              )}
              {loadingGlass ? (
                <tr><td colSpan={2} className="py-10 text-center text-[13px] text-[#94a3b8]">Cargando...</td></tr>
              ) : activeGlass.length === 0 && !showNewGlass ? (
                <tr><td colSpan={2} className="py-10 text-center text-[13px] text-[#94a3b8]">No hay tipos de vidrio. Creá el primero.</td></tr>
              ) : (
                activeGlass.map((g) => (
                  <SimpleRow
                    key={g.id}
                    item={g}
                    onSave={(id, name) => updateGlassType({ id, data: { name } })}
                    onDelete={(id) => deleteGlassType(id)}
                  />
                ))
              )}
            </tbody>
          </table>
          {!loadingGlass && activeGlass.length > 0 && (
            <p className="px-5 pb-3 text-[11px] text-[#94a3b8]">Clic en una fila para editar · Enter para guardar · Esc para cancelar</p>
          )}
        </Section>
      </div>

      {profileOpen && userId && (
        <ProfileModal
          userId={userId}
          userName={name}
          userEmail={email}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
