"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Check,
  Loader2,
  Car,
  Building2,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  useBrands,
  useCategories,
  useGlassTypes,
  useProduct,
  useCreateBrand,
  useCreateCategory,
  useCreateGlassType,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { uploadImage, uploadDocument } from "@/lib/api/products";

// ── Shared field components (same as new/page.tsx) ────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[12px] font-semibold text-[#374151]">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function Input({
  label,
  required,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        {...props}
        className={`h-[42px] w-full rounded-[10px] border px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f6e50]/20 ${
          error
            ? "border-red-400 bg-red-50 focus:border-red-400"
            : "border-[#dde4ee] bg-[#f8fafc] focus:border-[#0f6e50]"
        }`}
      />
      {hint && !error && <p className="mt-1 text-[11px] text-[#94a3b8]">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-4">
      <h2 className="text-[14px] font-bold text-[#0f172a]">{children}</h2>
      <div className="flex-1 border-t border-[#e8ecf2]" />
    </div>
  );
}

const PRESET_COLORS = [
  "#0f6e50", "#10b981", "#3b82f6", "#8b5cf6",
  "#f59e0b", "#ef4444", "#06b6d4", "#ec4899",
  "#84cc16", "#1d4ed8", "#7c3aed", "#0891b2",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <Label>Color de marca</Label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${value === c ? "ring-2 ring-offset-1 ring-[#0f6e50]" : ""}`}
            style={{ background: c }}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" title="Color personalizado" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="h-5 w-5 rounded-full border border-[#e8ecf2]" style={{ background: value }} />
        <span className="text-[12px] font-mono text-[#64748b]">{value}</span>
      </div>
    </div>
  );
}

function FileUploadZone({
  label, hint, accept, icon: Icon, preview, isUploading, onSelect, onClear,
}: {
  label: string; hint: string; accept: string; icon: React.ElementType;
  preview: string | null; isUploading: boolean;
  onSelect: (file: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const isPdf = preview?.endsWith(".pdf") || (preview && !preview.match(/\.(jpg|jpeg|png|webp|gif)$/i));
  return (
    <div>
      <Label>{label}</Label>
      {preview ? (
        <div className="relative flex items-center gap-3 rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] p-3">
          {isPdf ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-red-50">
              <FileText size={20} className="text-red-500" />
            </div>
          ) : (
            <img src={preview} alt="preview" className="h-12 w-12 rounded-[8px] object-cover" />
          )}
          <div className="flex-1">
            <p className="text-[12px] font-medium text-[#374151]">Archivo subido</p>
            <p className="max-w-[200px] truncate text-[11px] text-[#94a3b8]">{preview}</p>
          </div>
          <button type="button" onClick={onClear} className="rounded-full p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={isUploading}
          className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-[10px] border-2 border-dashed border-[#dde4ee] bg-[#f8fafc] px-4 py-6 text-center transition-colors hover:border-[#0f6e50]/50 hover:bg-[#f0faf6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? <Loader2 size={20} className="animate-spin text-[#0f6e50]" /> : <Icon size={20} className="text-[#94a3b8]" />}
          <span className="text-[12px] font-medium text-[#475569]">{isUploading ? "Subiendo..." : "Hacer clic para subir"}</span>
          <span className="text-[11px] text-[#94a3b8]">{hint}</span>
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onSelect(file);
        e.target.value = "";
      }} />
    </div>
  );
}

function InlineCreate({ placeholder, onConfirm, onCancel, isLoading }: {
  placeholder: string; onConfirm: (name: string) => void; onCancel: () => void; isLoading: boolean;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-[#0f6e50]/30 bg-[#f0faf6] p-2">
      <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) onConfirm(val.trim()); if (e.key === "Escape") onCancel(); }}
        className="flex-1 bg-transparent text-[12px] text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
      />
      <button type="button" onClick={() => val.trim() && onConfirm(val.trim())} disabled={isLoading || !val.trim()}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f6e50] text-white disabled:opacity-40"
      >
        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button type="button" onClick={onCancel} className="flex h-6 w-6 items-center justify-center rounded-full text-[#94a3b8] hover:text-[#475569]">
        <X size={12} />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  brand?: string;
  category?: string;
  application_types?: string;
  sale_price?: string;
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const role = session?.role;

  const { data: product, isPending: loadingProduct } = useProduct(id);
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const { data: glassTypes = [] } = useGlassTypes();

  const { mutateAsync: createBrand, isPending: creatingBrand } = useCreateBrand();
  const { mutateAsync: createCategory, isPending: creatingCategory } = useCreateCategory();
  const { mutateAsync: createGlassType, isPending: creatingGlassType } = useCreateGlassType();
  const { mutateAsync: updateProduct, isPending: saving } = useUpdateProduct();

  // Form state — initialized empty, populated via useEffect once product loads
  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [uv, setUv] = useState("");
  const [irr, setIrr] = useState("");
  const [tser, setTser] = useState("");
  const [warrantyYears, setWarrantyYears] = useState("");
  const [rollWidthCm, setRollWidthCm] = useState("152");
  const [rollLengthM, setRollLengthM] = useState("30");
  const [appTypes, setAppTypes] = useState<string[]>([]);
  const [glassIds, setGlassIds] = useState<string[]>([]);
  const [techSheetUrl, setTechSheetUrl] = useState<string | null>(null);

  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newBrandColor, setNewBrandColor] = useState("#0f6e50");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewGlassType, setShowNewGlassType] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Populate form once product data arrives
  useEffect(() => {
    if (product && !initialized) {
      setName(product.name);
      setBrandId(product.brand_id);
      setCategoryId(product.category_id);
      setSalePrice(String(product.sale_price_per_m2));
      setUv(String(product.uv_percentage));
      setIrr(String(product.irr_percentage));
      setTser(String(product.tser_percentage));
      setWarrantyYears(String(product.warranty_years));
      setRollWidthCm(String(product.roll_width_cm ?? 152));
      setRollLengthM(String(product.roll_length_m ?? 30));
      setAppTypes(product.application_types);
      setGlassIds(product.compatible_glass_ids);
      setTechSheetUrl(product.technical_sheet_url);
      setInitialized(true);
    }
  }, [product, initialized]);

  if (role && role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
        <p className="text-[14px] text-[#64748b]">No tenés permisos para acceder a esta página.</p>
      </div>
    );
  }

  if (loadingProduct || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
        <p className="text-[13px] text-[#94a3b8]">Cargando producto...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
        <div className="text-center">
          <p className="text-[14px] text-[#64748b]">Producto no encontrado.</p>
          <Link href="/products" className="mt-3 inline-block text-[13px] text-[#0f6e50] underline">Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = "El nombre es obligatorio";
    if (!brandId) errs.brand = "Seleccioná una marca";
    if (!categoryId) errs.category = "Seleccioná una categoría";
    if (!salePrice || isNaN(Number(salePrice)) || Number(salePrice) < 0)
      errs.sale_price = "Ingresá un precio válido";
    if (appTypes.length === 0) errs.application_types = "Seleccioná al menos una aplicación";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    try {
      await updateProduct({
        id,
        data: {
          name: name.trim(),
          brand_id: brandId,
          sale_price_per_m2: Number(salePrice),
          uv_percentage: Number(uv) || 0,
          irr_percentage: Number(irr) || 0,
          tser_percentage: Number(tser) || 0,
          warranty_years: Number(warrantyYears) || 0,
          category_id: categoryId,
          roll_width_cm: Number(rollWidthCm) || 152,
          roll_length_m: Number(rollLengthM) || 30,
          application_types: appTypes,
          compatible_glass_ids: glassIds,
          technical_sheet_url: techSheetUrl,
        },
      });
      router.push(`/products/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al guardar los cambios");
    }
  }

  async function handleLogoUpload(file: File) {
    if (!token) return;
    setUploadingLogo(true);
    try { const url = await uploadImage(token, file); setLogoUrl(url); }
    catch (err) { setSubmitError(err instanceof Error ? err.message : "Error al subir el logo"); }
    finally { setUploadingLogo(false); }
  }

  async function handleSheetUpload(file: File) {
    if (!token) return;
    setUploadingSheet(true);
    try { const url = await uploadDocument(token, file); setTechSheetUrl(url); }
    catch (err) { setSubmitError(err instanceof Error ? err.message : "Error al subir la ficha técnica"); }
    finally { setUploadingSheet(false); }
  }

  async function handleCreateBrand(brandName: string) {
    const created = await createBrand({ name: brandName, color: newBrandColor, logo_url: logoUrl });
    setBrandId(created.id);
    setShowNewBrand(false);
    setLogoUrl(null);
    setNewBrandColor("#0f6e50");
  }

  async function handleCreateCategory(catName: string) {
    const created = await createCategory({ name: catName });
    setCategoryId(created.id);
    setShowNewCategory(false);
  }

  async function handleCreateGlassType(gtName: string) {
    const created = await createGlassType({ name: gtName });
    setGlassIds((prev) => [...prev, created.id]);
    setShowNewGlassType(false);
  }

  function toggleGlass(gid: string) {
    setGlassIds((prev) => prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]);
  }

  function toggleAppType(type: string) {
    setAppTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  }

  const selectedBrand = brands.find((b) => b.id === brandId);

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between bg-[#0f6e50] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/products/${id}`}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-bold text-[17px] text-white">Editar producto</h1>
            <p className="text-[11px] text-white/70">{product.name}</p>
          </div>
        </div>
      </header>

      {/* ── Form ────────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-5">

        {submitError && (
          <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
            {submitError}
          </div>
        )}

        {/* ── Información básica ─────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
          <SectionTitle>Información básica</SectionTitle>
          <div className="space-y-5">
            <Input
              label="Nombre del producto" required
              placeholder="Ej: Lámina Solar Premium HP 35"
              value={name} onChange={(e) => setName(e.target.value)} error={errors.name}
            />

            {/* Brand */}
            <div>
              <div className="flex items-end justify-between">
                <Label required>Marca</Label>
                {!showNewBrand && (
                  <button type="button" onClick={() => setShowNewBrand(true)}
                    className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[#0f6e50] hover:underline"
                  >
                    <Plus size={11} /> Nueva marca
                  </button>
                )}
              </div>
              {!showNewBrand ? (
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)}
                  className={`h-[42px] w-full rounded-[10px] border px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0f6e50]/20 ${
                    errors.brand ? "border-red-400 bg-red-50" : "border-[#dde4ee] bg-[#f8fafc] focus:border-[#0f6e50]"
                  }`}
                >
                  <option value="">Seleccioná una marca...</option>
                  {brands.filter((b) => b.is_active).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-[12px] border border-[#0f6e50]/30 bg-[#f0faf6] p-4 space-y-4">
                  <p className="text-[12px] font-semibold text-[#0f6e50]">Crear nueva marca</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Nombre de la marca" required placeholder="Ej: 3M, LLumar, SunTek" id="new-brand-name-edit" />
                    <ColorPicker value={newBrandColor} onChange={setNewBrandColor} />
                  </div>
                  <FileUploadZone label="Logo de la marca" hint="PNG, JPG, WebP hasta 10 MB" accept="image/*"
                    icon={ImageIcon} preview={logoUrl} isUploading={uploadingLogo}
                    onSelect={handleLogoUpload} onClear={() => setLogoUrl(null)}
                  />
                  <div className="flex gap-2">
                    <button type="button" disabled={creatingBrand}
                      onClick={() => { const inp = document.getElementById("new-brand-name-edit") as HTMLInputElement; if (inp?.value.trim()) handleCreateBrand(inp.value.trim()); }}
                      className="flex items-center gap-1.5 rounded-[8px] bg-[#0f6e50] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0a5a40] disabled:opacity-60"
                    >
                      {creatingBrand ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Guardar marca
                    </button>
                    <button type="button" onClick={() => { setShowNewBrand(false); setLogoUrl(null); }}
                      className="rounded-[8px] border border-[#e8ecf2] px-4 py-2 text-[12px] text-[#475569] hover:bg-[#f1f5f9]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              {errors.brand && <p className="mt-1 text-[11px] text-red-500">{errors.brand}</p>}
              {selectedBrand && (
                <div className="mt-2 flex items-center gap-2 rounded-[8px] bg-[#f0faf6] px-3 py-2">
                  {selectedBrand.logo_url ? (
                    <img src={selectedBrand.logo_url} alt={selectedBrand.name} className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: selectedBrand.color }}>
                      {selectedBrand.name.charAt(0)}
                    </span>
                  )}
                  <span className="text-[12px] font-medium text-[#0f6e50]">{selectedBrand.name}</span>
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <div className="flex items-end justify-between">
                <Label required>Categoría</Label>
                {!showNewCategory && (
                  <button type="button" onClick={() => setShowNewCategory(true)}
                    className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[#0f6e50] hover:underline"
                  >
                    <Plus size={11} /> Nueva categoría
                  </button>
                )}
              </div>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className={`h-[42px] w-full rounded-[10px] border px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0f6e50]/20 ${
                  errors.category ? "border-red-400 bg-red-50" : "border-[#dde4ee] bg-[#f8fafc] focus:border-[#0f6e50]"
                }`}
              >
                <option value="">Seleccioná una categoría...</option>
                {categories.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-[11px] text-red-500">{errors.category}</p>}
              {showNewCategory && (
                <InlineCreate placeholder="Nombre de la categoría" onConfirm={handleCreateCategory}
                  onCancel={() => setShowNewCategory(false)} isLoading={creatingCategory}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Disponibilidad ─────────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
          <SectionTitle>Disponibilidad</SectionTitle>
          <div className="space-y-5">
            <div>
              <Label required>Apta para</Label>
              <div className="flex gap-3">
                {[
                  { value: "WINDOW", label: "Ventanas", icon: Building2 },
                  { value: "AUTOMOTIVE", label: "Automóviles", icon: Car },
                ].map(({ value, label, icon: Icon }) => {
                  const selected = appTypes.includes(value);
                  return (
                    <button key={value} type="button" onClick={() => toggleAppType(value)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] border-2 py-3 text-[13px] font-semibold transition-colors ${
                        selected
                          ? "border-[#0f6e50] bg-[#f0faf6] text-[#0f6e50]"
                          : "border-[#dde4ee] bg-[#f8fafc] text-[#94a3b8] hover:border-[#0f6e50]/40 hover:text-[#475569]"
                      }`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  );
                })}
              </div>
              {errors.application_types && <p className="mt-1 text-[11px] text-red-500">{errors.application_types}</p>}
            </div>

            <div>
              <div className="flex items-end justify-between">
                <Label>Vidrios compatibles</Label>
                {!showNewGlassType && (
                  <button type="button" onClick={() => setShowNewGlassType(true)}
                    className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[#0f6e50] hover:underline"
                  >
                    <Plus size={11} /> Nuevo tipo
                  </button>
                )}
              </div>
              {glassTypes.length === 0 && !showNewGlassType ? (
                <p className="text-[12px] text-[#94a3b8]">
                  No hay tipos de vidrio.{" "}
                  <button type="button" onClick={() => setShowNewGlassType(true)} className="text-[#0f6e50] underline">Crear el primero</button>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {glassTypes.filter((g) => g.is_active).map((g) => {
                    const selected = glassIds.includes(g.id);
                    return (
                      <button key={g.id} type="button" onClick={() => toggleGlass(g.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                          selected
                            ? "border-[#0f6e50] bg-[#0f6e50] text-white"
                            : "border-[#dde4ee] bg-[#f8fafc] text-[#475569] hover:border-[#0f6e50]/40"
                        }`}
                      >
                        {selected && <Check size={11} />} {g.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {showNewGlassType && (
                <InlineCreate placeholder="Nombre del vidrio (ej: Monolítico, DVH)" onConfirm={handleCreateGlassType}
                  onCancel={() => setShowNewGlassType(false)} isLoading={creatingGlassType}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Especificaciones ───────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
          <SectionTitle>Especificaciones técnicas</SectionTitle>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="UV%" required type="number" min="0" max="100" step="0.01" placeholder="0 — 100"
              value={uv} onChange={(e) => setUv(e.target.value)} hint="Rechazo UV" />
            <Input label="IRR%" required type="number" min="0" max="100" step="0.01" placeholder="0 — 100"
              value={irr} onChange={(e) => setIrr(e.target.value)} hint="Rechazo infrarrojo" />
            <Input label="TSER%" required type="number" min="0" max="100" step="0.01" placeholder="0 — 100"
              value={tser} onChange={(e) => setTser(e.target.value)} hint="Rechazo solar total" />
            <Input label="Años de garantía" required type="number" min="0" step="1" placeholder="Ej: 10"
              value={warrantyYears} onChange={(e) => setWarrantyYears(e.target.value)} hint="Garantía fabricante" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Input label="Ancho del rollo (cm)" type="number" min="1" step="0.5" placeholder="152"
              value={rollWidthCm} onChange={(e) => setRollWidthCm(e.target.value)}
              hint="Ancho estándar de la lámina en rollo" />
            <Input label="Largo del rollo (m)" type="number" min="1" step="0.5" placeholder="30"
              value={rollLengthM} onChange={(e) => setRollLengthM(e.target.value)}
              hint="Longitud del rollo en metros" />
          </div>
        </div>

        {/* ── Precio ─────────────────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
          <SectionTitle>Precio</SectionTitle>
          <div className="max-w-xs">
            <Label required>Precio de venta por m²</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#94a3b8]">$</span>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className={`h-[42px] w-full rounded-[10px] border pl-7 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f6e50]/20 ${
                  errors.sale_price ? "border-red-400 bg-red-50" : "border-[#dde4ee] bg-[#f8fafc] focus:border-[#0f6e50]"
                }`}
              />
            </div>
            {errors.sale_price && <p className="mt-1 text-[11px] text-red-500">{errors.sale_price}</p>}
          </div>
        </div>

        {/* ── Documentación ──────────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
          <SectionTitle>Documentación</SectionTitle>
          <div className="max-w-md">
            <FileUploadZone label="Ficha técnica del producto" hint="Imagen o PDF hasta 10 MB"
              accept="image/*,application/pdf" icon={FileText}
              preview={techSheetUrl} isUploading={uploadingSheet}
              onSelect={handleSheetUpload} onClear={() => setTechSheetUrl(null)}
            />
          </div>
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-[14px] border border-[#e8ecf2] bg-white px-6 py-4">
          <Link href={`/products/${id}`}
            className="rounded-[10px] border border-[#e8ecf2] px-5 py-2.5 text-[13px] font-medium text-[#475569] hover:bg-[#f1f5f9]"
          >
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-[10px] bg-[#0f6e50] px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-[#0a5a40] disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

      </form>
    </div>
  );
}
