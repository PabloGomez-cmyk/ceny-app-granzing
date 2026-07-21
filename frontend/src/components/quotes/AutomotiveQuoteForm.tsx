"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Car, DollarSign, Plus, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { useUser } from "@/hooks/useUsers";
import { useCreateQuote, useUpdateQuote } from "@/hooks/useQuotes";
import { useEffectivePriceList } from "@/hooks/usePriceLists";
import { CustomerPicker } from "@/components/quotes/CustomerPicker";
import type { CreateQuoteInput, Quote } from "@/lib/api/quotes";

const DEFAULT_CONDITIONS =
  "Presupuesto válido por 15 días.\nForma de pago: 50% anticipo, 50% contra entrega.\nGarantía según especificaciones del fabricante.";

interface LineEntry {
  key: string;
  product_id: string;
  quantity: string;
  price_per_unit: string;
}

function fmt(n: number) {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

function makeKey(): string {
  return Math.random().toString(36).slice(2);
}

export function AutomotiveQuoteForm({
  initialQuote,
  onBack,
}: {
  initialQuote?: Quote;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.userId;
  const { data: userData } = useUser(userId ?? "");
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: priceList = [] } = useEffectivePriceList(userId);
  const priceByProduct = useMemo(
    () => Object.fromEntries(priceList.map((i) => [i.product_id, i])),
    [priceList]
  );
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();

  const automotiveProducts = useMemo(
    () => products.filter((p) => p.is_active && p.application_types.includes("AUTOMOTIVE")),
    [products]
  );

  const [customerId, setCustomerId] = useState(initialQuote?.customer_id ?? "");
  const [lines, setLines] = useState<LineEntry[]>(() =>
    initialQuote && initialQuote.lines.length > 0
      ? initialQuote.lines.map((l) => ({
          key: makeKey(),
          product_id: l.product_id,
          quantity: String(l.quantity ?? ""),
          price_per_unit: String(l.price_per_m2),
        }))
      : [{ key: makeKey(), product_id: "", quantity: "", price_per_unit: "" }]
  );
  const [travelCost, setTravelCost] = useState(Number(initialQuote?.travel_cost ?? 0));
  const [discountPct, setDiscountPct] = useState(Number(initialQuote?.discount_pct ?? 0));
  const [taxPct, setTaxPct] = useState(Number(initialQuote?.tax_pct ?? 0));
  const [conditions, setConditions] = useState(initialQuote?.commercial_conditions ?? DEFAULT_CONDITIONS);

  useEffect(() => {
    if (!initialQuote && userData?.default_commercial_conditions) {
      setConditions(userData.default_commercial_conditions);
    }
  }, [initialQuote, userData?.default_commercial_conditions]);

  function addLine() {
    setLines((prev) => [...prev, { key: makeKey(), product_id: "", quantity: "", price_per_unit: "" }]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function updateLine(key: string, patch: Partial<LineEntry>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.product_id && patch.product_id !== l.product_id) {
          const product = automotiveProducts.find((p) => p.id === patch.product_id);
          if (product) {
            const effective = priceByProduct[product.id];
            const price = Number(
              effective ? effective.effective_sale_price_per_unit : product.sale_price_per_unit
            );
            next.price_per_unit = String(price);
          }
        }
        return next;
      })
    );
  }

  const validLines = lines.filter(
    (l) => l.product_id && parseFloat(l.quantity) > 0 && parseFloat(l.price_per_unit) >= 0
  );

  const materialsSub = validLines.reduce(
    (s, l) => s + parseFloat(l.quantity) * parseFloat(l.price_per_unit),
    0
  );
  const subtotal = materialsSub + travelCost;
  const discountAmount = Math.round(subtotal * discountPct) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * taxPct) / 100;
  const total = taxableAmount + taxAmount;

  const canSave = validLines.length > 0 && validLines.length === lines.length;
  const saving = createQuote.isPending || updateQuote.isPending;

  async function handleSave() {
    if (!canSave) return;
    const today = new Date();
    const validUntil = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const selectedCustomer = customers.find((c) => c.id === customerId);
    const customerSnapshot = selectedCustomer
      ? {
          name: selectedCustomer.name,
          email: selectedCustomer.email ?? null,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address,
        }
      : null;

    const quoteLines = validLines.map((l) => {
      const product = automotiveProducts.find((p) => p.id === l.product_id)!;
      const effective = priceByProduct[product.id];
      const cost = Number(
        effective
          ? effective.effective_purchase_price_per_unit
          : product.purchase_price_per_unit
      );
      const quantity = Math.round(parseFloat(l.quantity) * 100) / 100;
      const price = parseFloat(l.price_per_unit);
      return {
        product_id: product.id,
        product_snapshot: {
          name: product.name,
          brand_name: "",
          brand_color: "#d9622c",
          price_per_m2: price,
          uv_pct: product.uv_percentage,
          irr_pct: product.irr_percentage,
          purchase_price_per_unit: cost,
        },
        glass_pane_ids: [],
        price_per_m2: price,
        surface_m2: null,
        quantity,
        subtotal: Math.round(quantity * price * 100) / 100,
      };
    });

    const payload: CreateQuoteInput = {
      customer_id: customerId || null,
      customer_snapshot: customerSnapshot,
      sale_type: "AUTOMOTIVE",
      film_mode: "SINGLE",
      glass_panes: [],
      lines: quoteLines,
      height_surcharge_pct: 0,
      travel_cost: travelCost,
      discount_pct: discountPct,
      tax_pct: taxPct,
      gap_cm: 0,
      commercial_conditions: conditions,
      cut_plan_snapshot: {},
      valid_until: validUntil,
    };

    try {
      if (initialQuote) {
        await updateQuote.mutateAsync({ id: initialQuote.id, data: payload });
        router.push(`/orders/${initialQuote.id}` as never);
      } else {
        const quote = await createQuote.mutateAsync(payload);
        router.push(`/orders/${quote.id}` as never);
      }
    } catch (_) {
      // error manejado por el query client
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748b] hover:text-[#d9622c]"
        >
          <ArrowLeft size={13} />
          Cambiar tipo de venta
        </button>
      )}

      <CustomerPicker customerId={customerId} setCustomerId={setCustomerId} />

      {/* Lines */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]">
            <Car size={16} className="text-[#d9622c]" />
            Polarizado Automotriz
          </div>
          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1 text-[12px] font-semibold text-[#d9622c] hover:text-[#b74e1e]"
          >
            <Plus size={13} />
            Agregar producto
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line) => {
            const product = automotiveProducts.find((p) => p.id === line.product_id);
            const quantity = parseFloat(line.quantity) || 0;
            const price = parseFloat(line.price_per_unit) || 0;
            return (
              <div key={line.key} className="grid grid-cols-1 gap-2 rounded-[10px] border border-[#f1f5f9] p-3 sm:grid-cols-[1fr_110px_130px_28px] sm:items-end">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Producto</label>
                  <select
                    value={line.product_id}
                    onChange={(e) => updateLine(line.key, { product_id: e.target.value })}
                    className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {automotiveProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Cantidad</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    placeholder="1"
                    className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Precio $/unidad</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.price_per_unit}
                    onChange={(e) => updateLine(line.key, { price_per_unit: e.target.value })}
                    className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#94a3b8] hover:text-red-500 disabled:opacity-30"
                  title="Quitar"
                >
                  <Trash2 size={14} />
                </button>
                {product && quantity > 0 && price > 0 && (
                  <div className="sm:col-span-4 text-right text-[11px] text-[#94a3b8]">
                    Subtotal: <span className="font-semibold text-[#0f172a]">{fmt(quantity * price)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {automotiveProducts.length === 0 && (
          <p className="mt-3 text-center text-[12px] text-[#94a3b8]">
            No hay productos activos marcados para uso automotriz. Cargalos desde Catálogo.
          </p>
        )}
      </div>

      {/* Financial */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]">
          <DollarSign size={15} className="text-emerald-500" />
          Cálculo Financiero
        </div>

        <div className="space-y-3">
          {/* Viáticos */}
          <div className="rounded-[12px] border border-[#e8ecf2] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-blue-50 text-[14px]">🚗</span>
                <span className="text-[13px] font-semibold text-[#0f172a]">Viáticos / Desplazamiento</span>
              </div>
              <span className="text-[14px] font-bold text-[#0f172a]">{fmt(travelCost)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 500, 1000, 2000, 5000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTravelCost(v)}
                  className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all ${
                    travelCost === v ? "bg-blue-600 text-white shadow-sm" : "bg-[#f1f5f9] text-[#475569] hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  {v === 0 ? "Sin viático" : `$ ${v.toLocaleString("es-AR")}`}
                </button>
              ))}
              <label className="flex cursor-text items-center gap-1 rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-1.5 focus-within:border-blue-400">
                <span className="text-[11px] font-medium text-[#94a3b8]">$</span>
                <input
                  type="number"
                  placeholder="Otro"
                  value={[0, 500, 1000, 2000, 5000].includes(travelCost) ? "" : travelCost || ""}
                  onChange={(e) => setTravelCost(parseFloat(e.target.value) || 0)}
                  className="w-20 bg-transparent text-[12px] text-[#0f172a] placeholder:text-[#cbd5e1] focus:outline-none"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[10px] bg-[#f8fafc] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#475569]">Subtotal</p>
            <p className="text-[15px] font-bold text-[#0f172a]">{fmt(subtotal)}</p>
          </div>

          {/* Descuento / Recargo */}
          <div className="rounded-[12px] border border-[#e8ecf2] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#0f172a]">Ajuste de precio</span>
              {discountPct !== 0 && (
                <span className={`text-[13px] font-bold ${discountPct > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {discountPct > 0 ? `−${fmt(discountAmount)}` : `+${fmt(Math.abs(discountAmount))}`}
                </span>
              )}
            </div>
            <div className="mb-3 flex rounded-[10px] bg-[#f1f5f9] p-1">
              <button
                type="button"
                onClick={() => { if (discountPct < 0) setDiscountPct(-discountPct); }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-[12px] font-semibold transition-all ${discountPct >= 0 ? "bg-white text-emerald-700 shadow-sm" : "text-[#94a3b8] hover:text-[#475569]"}`}
              >
                <span>🏷️</span> Descuento
              </button>
              <button
                type="button"
                onClick={() => { if (discountPct > 0) setDiscountPct(-discountPct); else if (discountPct === 0) setDiscountPct(-1); }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-[12px] font-semibold transition-all ${discountPct < 0 ? "bg-white text-red-600 shadow-sm" : "text-[#94a3b8] hover:text-[#475569]"}`}
              >
                <span>📈</span> Recargo
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 5, 10, 15, 20].map((v) => {
                const actual = discountPct < 0 ? -v : v;
                const isActive = v === 0 ? discountPct === 0 : discountPct === actual;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDiscountPct(discountPct < 0 ? -v : v)}
                    className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all ${
                      isActive
                        ? discountPct <= 0
                          ? "bg-red-500 text-white shadow-sm"
                          : "bg-emerald-600 text-white shadow-sm"
                        : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e8ecf2]"
                    }`}
                  >
                    {v === 0 ? "Sin ajuste" : `${v}%`}
                  </button>
                );
              })}
              <label className={`flex cursor-text items-center gap-1 rounded-[8px] border bg-white px-2.5 py-1.5 focus-within:border-emerald-400 ${![0, 5, 10, 15, 20].includes(Math.abs(discountPct)) ? "border-emerald-400 bg-emerald-50" : "border-[#dde4ee]"}`}>
                <input
                  type="number"
                  min={0}
                  max={50}
                  placeholder="Otro %"
                  value={[0, 5, 10, 15, 20].includes(Math.abs(discountPct)) ? "" : Math.abs(discountPct) || ""}
                  onChange={(e) => {
                    const abs = Math.min(50, parseFloat(e.target.value) || 0);
                    setDiscountPct(discountPct < 0 ? -abs : abs);
                  }}
                  className="w-16 bg-transparent text-[12px] text-[#0f172a] placeholder:text-[#cbd5e1] focus:outline-none"
                />
                <span className="text-[11px] text-[#94a3b8]">%</span>
              </label>
            </div>
          </div>

          {/* IVA */}
          <div className={`flex items-center justify-between rounded-[12px] border px-4 py-3 transition-colors ${taxPct > 0 ? "border-violet-200 bg-violet-50" : "border-[#e8ecf2] bg-[#f8fafc]"}`}>
            <div>
              <p className={`text-[13px] font-semibold ${taxPct > 0 ? "text-violet-700" : "text-[#475569]"}`}>IVA</p>
              {taxPct > 0 && <p className="text-[11px] text-violet-400">Sobre base imponible (subtotal − descuento)</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTaxPct(0)}
                className={`rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition-all ${taxPct === 0 ? "bg-[#475569] text-white shadow-sm" : "bg-white border border-[#dde4ee] text-[#94a3b8] hover:border-[#475569] hover:text-[#475569]"}`}
              >
                Sin IVA
              </button>
              <button
                type="button"
                onClick={() => setTaxPct(21)}
                className={`rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition-all ${taxPct === 21 ? "bg-violet-600 text-white shadow-sm" : "bg-white border border-[#dde4ee] text-[#94a3b8] hover:border-violet-400 hover:text-violet-600"}`}
              >
                IVA 21%
              </button>
              {taxPct > 0 && (
                <span className="min-w-[70px] text-right text-[13px] font-bold text-violet-700">+{fmt(taxAmount)}</span>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-[12px] bg-[#d9622c] px-5 py-4">
            <div className="space-y-0.5">
              <p className="text-[14px] font-bold tracking-wide text-white">TOTAL</p>
              {travelCost > 0 && <p className="text-[11px] text-white/70">Inc. viáticos $ {Math.round(travelCost).toLocaleString("es-AR")}</p>}
              {discountPct !== 0 && <p className="text-[11px] text-white/70">{discountPct > 0 ? `Desc. ${discountPct}%` : `Recargo ${Math.abs(discountPct)}%`}</p>}
              {taxPct > 0 && <p className="text-[11px] text-white/70">IVA {taxPct}% inc.</p>}
            </div>
            <p className="text-[22px] font-bold text-white">{fmt(total)}</p>
          </div>
        </div>
      </div>

      {/* Commercial conditions */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#0f172a]">
          Condiciones Comerciales
        </div>
        <textarea
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 py-2.5 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSave}
          className="flex items-center gap-2 rounded-[10px] bg-[#d9622c] px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40 hover:bg-[#b74e1e]"
        >
          {saving ? "Guardando..." : initialQuote ? "Guardar cambios" : "Guardar Presupuesto"}
        </button>
      </div>
    </div>
  );
}
