"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  ChevronRight,
  Sun,
  Shield,
  Tag,
  Car,
  Building2,
  Settings2,
} from "lucide-react";
import { useProducts, useBrands, useCategories } from "@/hooks/useProducts";
import { useEffectivePriceList } from "@/hooks/usePriceLists";
import UserMenu from "@/components/layout/UserMenu";
import ProfileModal from "@/components/profile/ProfileModal";
import type { Brand, Product, ProductCategory } from "@/lib/api/products";

// ── Helpers ───────────────────────────────────────────────────────────────────

const APPLICATION_LABELS: Record<string, string> = {
  WINDOW: "Ventanas",
  AUTOMOTIVE: "Automotriz",
};

function AppTypeBadge({ type }: { type: string }) {
  const isAuto = type === "AUTOMOTIVE";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        isAuto
          ? "bg-blue-50 text-blue-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {isAuto ? <Car size={9} /> : <Building2 size={9} />}
      {APPLICATION_LABELS[type] ?? type}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function formatProductPrice(
  product: Product,
  effectivePricePerM2?: number,
  effectivePricePerUnit?: number
): string {
  if (product.default_sale_unit === "UNIT") {
    const price = effectivePricePerUnit ?? product.sale_price_per_unit;
    if (!price) return "Sin precio configurado";
    return `$${Number(price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}/u.`;
  }
  const price = effectivePricePerM2 ?? product.sale_price_per_m2;
  return `$${Number(price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}/m²`;
}

function BrandChip({ brand }: { brand: Brand | undefined }) {
  if (!brand) return <span className="text-[12px] text-[#cbd5e1]">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      {brand.logo_url ? (
        <img src={brand.logo_url} alt={brand.name} className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ background: brand.color }}
        >
          {brand.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-[12px] text-[#374151]">{brand.name}</span>
    </div>
  );
}

function StatCard({
  value,
  label,
  sub,
  accent,
}: {
  value: string | number;
  label: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[12px] border bg-white p-4 ${
        accent ? "border-l-4 border-l-amber-400 border-[#e8ecf2]" : "border-[#e8ecf2]"
      }`}
    >
      <p className={`font-bold text-[28px] leading-none ${accent ? "text-amber-500" : "text-[#0f172a]"}`}>
        {value}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#374151]">{label}</p>
      <p className="text-[11px] text-[#94a3b8]">{sub}</p>
    </div>
  );
}

// ── Product row (desktop) ─────────────────────────────────────────────────────

function ProductRow({
  product,
  brand,
  category,
  onClick,
  effectivePrice,
  effectivePricePerUnit,
  tourAnchor,
}: {
  product: Product;
  brand: Brand | undefined;
  category: ProductCategory | undefined;
  onClick: () => void;
  effectivePrice?: number;
  effectivePricePerUnit?: number;
  tourAnchor?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafb]"
    >
      <td className="py-3 pl-5 pr-3">
        <p className="text-[13px] font-semibold text-[#0f172a]">{product.name}</p>
      </td>
      <td className="px-3 py-3">
        <BrandChip brand={brand} />
      </td>
      <td className="px-3 py-3">
        {category ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            <Tag size={10} />
            {category.name}
          </span>
        ) : (
          <span className="text-[12px] text-[#cbd5e1]">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {product.application_types.map((t) => (
            <AppTypeBadge key={t} type={t} />
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5 text-[11px] text-[#64748b]">
          <span className="flex items-center gap-1">
            <Sun size={10} className="text-amber-400" />
            UV {product.uv_percentage}% · IRR {product.irr_percentage}%
          </span>
          <span className="flex items-center gap-1">
            <Shield size={10} className="text-blue-400" />
            TSER {product.tser_percentage}%
          </span>
        </div>
      </td>
      <td
        className="px-3 py-3 text-right text-[13px] font-bold text-[#d9622c]"
        data-tour={tourAnchor ? "products-price" : undefined}
      >
        {formatProductPrice(product, effectivePrice, effectivePricePerUnit)}
      </td>
      <td className="px-3 py-3">
        <ActiveBadge active={product.is_active} />
      </td>
      <td className="py-3 pl-3 pr-5">
        <ChevronRight size={16} className="text-[#94a3b8]" />
      </td>
    </tr>
  );
}

// ── Product card (mobile) ─────────────────────────────────────────────────────

function ProductCard({
  product,
  brand,
  category,
  onClick,
  effectivePrice,
  effectivePricePerUnit,
  tourAnchor,
}: {
  product: Product;
  brand: Brand | undefined;
  category: ProductCategory | undefined;
  onClick: () => void;
  effectivePrice?: number;
  effectivePricePerUnit?: number;
  tourAnchor?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-[12px] border border-[#e8ecf2] bg-white p-4 hover:border-[#d9622c]/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[#0f172a]">{product.name}</p>
          <BrandChip brand={brand} />
        </div>
        <ActiveBadge active={product.is_active} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {product.application_types.map((t) => (
          <AppTypeBadge key={t} type={t} />
        ))}
        {category && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            <Tag size={9} />
            {category.name}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#f1f5f9] pt-3">
        <span className="text-[11px] text-[#64748b]">
          UV {product.uv_percentage}% · IRR {product.irr_percentage}% · TSER {product.tser_percentage}%
        </span>
        <span
          className="text-[13px] font-bold text-[#d9622c]"
          data-tour={tourAnchor ? "products-price" : undefined}
        >
          {formatProductPrice(product, effectivePrice, effectivePricePerUnit)}
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { data: session, status } = useSession();
  const role = session?.role;
  const isAdmin = role === "ADMIN";
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const userId = session?.userId;

  const { data: products = [], isLoading } = useProducts();
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const { data: priceList = [] } = useEffectivePriceList(userId);
  const priceByProduct = useMemo(
    () => Object.fromEntries(priceList.map((i) => [i.product_id, i.effective_sale_price])),
    [priceList]
  );
  const priceByProductPerUnit = useMemo(
    () => Object.fromEntries(priceList.map((i) => [i.product_id, i.effective_sale_price_per_unit])),
    [priceList]
  );

  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"active" | "all">("active");
  const [profileOpen, setProfileOpen] = useState(false);

  const brandsMap = useMemo(() => {
    const m = new Map<string, Brand>();
    for (const b of brands) m.set(b.id, b);
    return m;
  }, [brands]);

  const categoriesMap = useMemo(() => {
    const m = new Map<string, ProductCategory>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchFilter = filterActive === "all" || p.is_active;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (brandsMap.get(p.brand_id)?.name ?? "").toLowerCase().includes(q) ||
        (categoriesMap.get(p.category_id)?.name ?? "").toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [products, filterActive, search, brandsMap, categoriesMap]);

  if (status === "loading") return null;

  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between bg-[#d9622c] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-bold text-[17px] text-white">Catálogo</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/products/settings"
              className="flex items-center gap-1.5 rounded-[8px] bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/25"
            >
              <Settings2 size={13} />
              <span className="hidden sm:inline">Configurar catálogo</span>
            </Link>
          )}
          <UserMenu
            name={name}
            email={email}
            role={role}
            onOpenProfile={() => setProfileOpen(true)}
            variant="dark"
          />
        </div>
      </header>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4eaf2] bg-white px-5 py-3">
        {isAdmin && (
          <Link
            href="/products/new"
            data-tour="products-new"
            className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e]"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nuevo producto</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        )}

        <div className="relative flex-1 sm:max-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o marca..."
            className="h-[36px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] pl-8 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
          />
        </div>

        <div className="flex overflow-hidden rounded-[10px] border border-[#dde4ee] bg-[#f8fafc]">
          {(["active", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterActive(tab)}
              className={`px-4 py-1.5 text-[12px] font-medium transition-colors ${
                filterActive === tab ? "bg-[#d9622c] text-white" : "text-[#475569] hover:bg-[#f1f5f9]"
              }`}
            >
              {tab === "active" ? "Activos" : "Todos"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[12px] text-[#94a3b8]">
          {filtered.length} producto{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 p-5">
        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={activeCount} label="Productos activos" sub={`de ${products.length} registrados`} />
          <StatCard value={brands.length} label="Marcas" sub="en el catálogo" />
          <StatCard value={categories.length} label="Categorías" sub="configuradas" />
          <StatCard value="—" label="Ventas recientes" sub="requiere módulo Ventas" accent />
        </div>

        {isLoading && (
          <p className="py-12 text-center text-[13px] text-[#94a3b8]">Cargando productos...</p>
        )}

        {/* ── Tabla desktop ───────────────────────────────────────────────── */}
        {!isLoading && (
          <div className="hidden overflow-hidden rounded-[12px] border border-[#e8ecf2] bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                  {["Producto", "Marca", "Categoría", "Aplicación", "Especificaciones", "Precio/m²", "Estado", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] first:pl-5 last:pr-5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[13px] text-[#94a3b8]">
                      {search
                        ? "Sin resultados para la búsqueda."
                        : filterActive === "active"
                        ? isAdmin
                          ? "No hay productos activos. ¡Crea el primero!"
                          : "No hay productos disponibles."
                        : "No hay productos registrados."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((product, i) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      brand={brandsMap.get(product.brand_id)}
                      category={categoriesMap.get(product.category_id)}
                      onClick={() => (window.location.href = `/products/${product.id}`)}
                      effectivePrice={priceByProduct[product.id]}
                      effectivePricePerUnit={priceByProductPerUnit[product.id]}
                      tourAnchor={i === 0}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Cards mobile ────────────────────────────────────────────────── */}
        {!isLoading && (
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-[#94a3b8]">
                {search ? "Sin resultados." : "No hay productos."}
              </p>
            ) : (
              filtered.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  brand={brandsMap.get(product.brand_id)}
                  category={categoriesMap.get(product.category_id)}
                  onClick={() => (window.location.href = `/products/${product.id}`)}
                  effectivePrice={priceByProduct[product.id]}
                  effectivePricePerUnit={priceByProductPerUnit[product.id]}
                  tourAnchor={i === 0}
                />
              ))
            )}
          </div>
        )}
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
