"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Car,
  Building2,
  Shield,
  Sun,
  Thermometer,
  Calendar,
  Tag,
  FileText,
  ExternalLink,
} from "lucide-react";
import { useProduct, useBrands, useCategories, useGlassTypes } from "@/hooks/useProducts";

const APPLICATION_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  WINDOW: { label: "Ventanas", icon: Building2 },
  AUTOMOTIVE: { label: "Automóviles", icon: Car },
};

function SpecItem({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[12px] border border-[#e8ecf2] bg-white p-4 text-center">
      <Icon size={18} className="text-[#d9622c]" />
      <p className="text-[22px] font-bold text-[#0f172a]">{value}</p>
      <p className="text-[11px] font-medium text-[#94a3b8]">{label}</p>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = session?.role;
  const isAdmin = role === "ADMIN";

  const { data: product, isPending, error } = useProduct(id);
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const { data: glassTypes = [] } = useGlassTypes();

  const brand = brands.find((b) => b.id === product?.brand_id);
  const category = categories.find((c) => c.id === product?.category_id);
  const compatibleGlass = glassTypes.filter((g) => product?.compatible_glass_ids.includes(g.id));

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
        <p className="text-[13px] text-[#94a3b8]">Cargando producto...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
        <div className="text-center">
          <p className="text-[14px] text-[#64748b]">Producto no encontrado.</p>
          <Link href="/products" className="mt-3 inline-block text-[13px] text-[#d9622c] underline">
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const isPdf = product.technical_sheet_url?.endsWith(".pdf");

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
          <div>
            <h1 className="font-bold text-[17px] text-white">{product.name}</h1>
            {brand && (
              <p className="text-[12px] text-white/70">{brand.name}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Link
            href={`/products/${id}/edit`}
            className="flex items-center gap-1.5 rounded-[8px] bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/25"
          >
            <Pencil size={13} />
            Editar
          </Link>
        )}
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-5 p-5">
        {/* ── Brand & Category ─────────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
          <div className="flex flex-wrap items-center gap-5">
            {brand && (
              <div className="flex items-center gap-3">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="h-12 w-12 rounded-full object-cover shadow" />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-bold text-white shadow"
                    style={{ background: brand.color }}
                  >
                    {brand.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Marca</p>
                  <p className="text-[15px] font-bold text-[#0f172a]">{brand.name}</p>
                </div>
              </div>
            )}

            {category && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                  <Tag size={11} />
                  {category.name}
                </span>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {product.application_types.map((t) => {
                const info = APPLICATION_LABELS[t];
                if (!info) return null;
                const Icon = info.icon;
                return (
                  <span
                    key={t}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                      t === "AUTOMOTIVE" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <Icon size={12} />
                    {info.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Specs ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SpecItem label="UV Rechazo" value={`${product.uv_percentage}%`} icon={Sun} />
          <SpecItem label="IRR Rechazo" value={`${product.irr_percentage}%`} icon={Thermometer} />
          <SpecItem label="TSER" value={`${product.tser_percentage}%`} icon={Shield} />
          <SpecItem label="Garantía" value={`${product.warranty_years} años`} icon={Calendar} />
        </div>

        {/* ── Price ───────────────────────────────────────────────────────── */}
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Precio de venta</p>
          <p className="mt-1 text-[32px] font-bold text-[#d9622c]">
            ${Number(product.sale_price_per_m2).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            <span className="ml-1 text-[16px] font-normal text-[#94a3b8]">/m²</span>
          </p>
        </div>

        {/* ── Compatible glass ─────────────────────────────────────────────── */}
        {compatibleGlass.length > 0 && (
          <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#94a3b8]">
              Vidrios compatibles
            </p>
            <div className="flex flex-wrap gap-2">
              {compatibleGlass.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-[#dde4ee] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-medium text-[#374151]"
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Technical sheet ──────────────────────────────────────────────── */}
        {product.technical_sheet_url && (
          <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-6">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#94a3b8]">
              Ficha técnica
            </p>
            {isPdf ? (
              <a
                href={product.technical_sheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] p-3 hover:border-[#d9622c]/40 hover:bg-[#fbeee1]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-red-50">
                  <FileText size={18} className="text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#0f172a]">Ficha técnica PDF</p>
                  <p className="text-[11px] text-[#94a3b8]">Abrir en nueva pestaña</p>
                </div>
                <ExternalLink size={14} className="text-[#94a3b8]" />
              </a>
            ) : (
              <img
                src={product.technical_sheet_url}
                alt="Ficha técnica"
                className="max-h-[400px] w-full rounded-[10px] object-contain"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
