"use client";

import { useState, useMemo, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQuote, useUpdateQuote } from "@/hooks/useQuotes";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import type { FilmMode, LocationType } from "@/lib/api/quotes";
import type { Product } from "@/lib/api/products";
import { CutDiagram, type CutPiece, type CutRow } from "@/components/quotes/CutDiagram";
import { useEffectivePriceList } from "@/hooks/usePriceLists";
import { AutomotiveQuoteForm } from "@/components/quotes/AutomotiveQuoteForm";

// ── Re-use shared logic from new/page via dynamic import workaround ────────────
// Instead of duplicating, we import the building blocks directly.

const ROLL_WIDTH_CM = 152;
const DEFAULT_ROLL_LENGTH_M = 30;

interface GlassEntry {
  pane_id: string;
  glass_type_id: string | null;
  glass_type_name: string;
  width_cm: number;
  height_cm: number;
  location: LocationType;
  quantity: number;
  notes: string;
  sort_order: number;
}

interface QuoteLineLocal {
  glass_pane_ids: string[];
  product_id: string;
  product_snapshot: Record<string, unknown>;
  price_per_m2: number;
  surface_m2: number;
  subtotal: number;
}

interface MaterialCutPlan {
  product_id: string;
  product_name: string;
  brand_name: string;
  brand_color: string;
  linear_m: number;
  rolls: number;
  efficiency_pct: number;
  area_useful_m2: number;
  cuts: CutRow[];
  roll_width_cm: number;
  roll_length_m: number;
}

interface CutPlan {
  materials: MaterialCutPlan[];
  total_linear_m: number;
  total_rolls: number;
}

function computeCutPlan(glassPanes: GlassEntry[], lines: QuoteLineLocal[], products: Product[], gapCm: number): CutPlan {
  const materials: MaterialCutPlan[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.id === line.product_id);
    const rollWidthCm = product?.roll_width_cm ?? ROLL_WIDTH_CM;
    const rollLengthM = product?.roll_length_m ?? DEFAULT_ROLL_LENGTH_M;
    const paneIds = new Set(line.glass_pane_ids);
    const assignedPanes = glassPanes.filter((p) => paneIds.has(p.pane_id));
    const pieces: CutPiece[] = [];
    for (const pane of assignedPanes) {
      for (let q = 0; q < pane.quantity; q++) {
        let w = pane.width_cm; let h = pane.height_cm; let rotated = false;
        if (w > rollWidthCm && h <= rollWidthCm) { [w, h] = [h, w]; rotated = true; }
        if (w <= rollWidthCm) {
          pieces.push({ pane_id: pane.pane_id, label: pane.pane_id, width_cm: w, height_cm: h, rotated });
        } else {
          const numPanos = Math.ceil(w / rollWidthCm);
          for (let pi = 0; pi < numPanos; pi++) {
            const pw = pi === numPanos - 1 ? w - rollWidthCm * (numPanos - 1) : rollWidthCm;
            pieces.push({ pane_id: pane.pane_id, label: `${pane.pane_id}-P${pi + 1}`, width_cm: pw, height_cm: h, rotated, pano_index: pi + 1, pano_total: numPanos });
          }
        }
      }
    }
    const sorted = [...pieces].sort((a, b) => b.height_cm - a.height_cm);
    const rows: CutRow[] = [];
    let currentRow: CutPiece[] = []; let currentWidth = 0; let currentHeight = 0;
    for (const piece of sorted) {
      const pieceW = piece.width_cm + gapCm;
      if (currentWidth + pieceW <= rollWidthCm) {
        currentRow.push(piece); currentWidth += pieceW; currentHeight = Math.max(currentHeight, piece.height_cm + gapCm);
      } else {
        if (currentRow.length > 0) rows.push({ pieces: currentRow, row_height_cm: currentHeight, used_width_cm: currentWidth });
        currentRow = [piece]; currentWidth = pieceW; currentHeight = piece.height_cm + gapCm;
      }
    }
    if (currentRow.length > 0) rows.push({ pieces: currentRow, row_height_cm: currentHeight, used_width_cm: currentWidth });
    const totalLinearCm = rows.reduce((s, r) => s + r.row_height_cm, 0);
    const totalLinearM = totalLinearCm / 100;
    const rolls = Math.ceil(totalLinearM / rollLengthM);
    const usefulArea = line.surface_m2;
    const rollArea = totalLinearM * (rollWidthCm / 100);
    const efficiency = rollArea > 0 ? (usefulArea / rollArea) * 100 : 0;
    const snap = line.product_snapshot as Record<string, string | number>;
    materials.push({ product_id: line.product_id, product_name: String(snap.name ?? ""), brand_name: String(snap.brand_name ?? ""), brand_color: String(snap.brand_color ?? "#d9622c"), linear_m: Math.round(totalLinearM * 1000) / 1000, rolls, efficiency_pct: Math.round(efficiency * 10) / 10, area_useful_m2: Math.round(usefulArea * 1000) / 1000, cuts: rows, roll_width_cm: rollWidthCm, roll_length_m: rollLengthM });
  }
  return { materials, total_linear_m: materials.reduce((s, m) => s + m.linear_m, 0), total_rolls: materials.reduce((s, m) => s + m.rolls, 0) };
}

// ── Step bar ──────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Medidas", "Lámina", "Confirmar"];
  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n; const done = step > n;
        return (
          <div key={label} className="flex items-center gap-1">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${active ? "bg-[#d9622c] text-white" : done ? "bg-[#d9622c]/20 text-[#d9622c]" : "bg-[#f1f5f9] text-[#94a3b8]"}`}>{n}</div>
            <span className={`hidden text-[12px] font-medium sm:inline ${active ? "text-[#0f172a]" : "text-[#94a3b8]"}`}>{label}</span>
            {i < 2 && <div className="mx-1 h-px w-4 bg-[#e8ecf2] sm:w-6" />}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: quote, isPending } = useQuote(id);
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: priceList = [] } = useEffectivePriceList(quote?.created_by_user_id);
  const priceByProduct = useMemo(
    () => Object.fromEntries(priceList.map((i) => [i.product_id, i])),
    [priceList]
  );
  const updateQuote = useUpdateQuote();

  // ── Wizard state (inicializado desde el quote existente) ──────────────────

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [initialized, setInitialized] = useState(false);

  const [glassPanes, setGlassPanes] = useState<GlassEntry[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [filmMode, setFilmMode] = useState<FilmMode>("SINGLE");
  const [singleProductId, setSingleProductId] = useState("");
  const [perGlassMap, setPerGlassMap] = useState<Record<string, string>>({});
  const [heightSurchargePct, setHeightSurchargePct] = useState(30);
  const [travelCost, setTravelCost] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [conditions, setConditions] = useState("");
  const [editableLines, setEditableLines] = useState<QuoteLineLocal[]>([]);
  const [gapCm, setGapCm] = useState(3);

  // Pre-poblar cuando llega el quote
  if (quote && !initialized) {
    setGlassPanes(
      quote.glass_panes.map((p) => ({
        pane_id: p.pane_id,
        glass_type_id: p.glass_type_id,
        glass_type_name: p.glass_type_name,
        width_cm: Number(p.width_cm),
        height_cm: Number(p.height_cm),
        location: p.location as LocationType,
        quantity: p.quantity,
        notes: p.notes ?? "",
        sort_order: p.sort_order,
      }))
    );
    setCustomerId(quote.customer_id ?? "");
    setFilmMode(quote.film_mode as FilmMode);
    setHeightSurchargePct(Number(quote.height_surcharge_pct));
    setTravelCost(Number(quote.travel_cost));
    setDiscountPct(Number(quote.discount_pct));
    setTaxPct(Number(quote.tax_pct));
    setConditions(quote.commercial_conditions);
    setGapCm(Number(quote.gap_cm ?? 3));

    // Reconstruir estado step2
    if (quote.film_mode === "SINGLE" && quote.lines.length > 0) {
      setSingleProductId(quote.lines[0].product_id);
    } else if (quote.film_mode === "PER_GLASS") {
      const map: Record<string, string> = {};
      for (const line of quote.lines) {
        for (const pid of line.glass_pane_ids) map[pid] = line.product_id;
      }
      setPerGlassMap(map);
    }

    // Pre-cargar lines editables con precios guardados
    setEditableLines(
      quote.lines.map((l) => ({
        glass_pane_ids: l.glass_pane_ids,
        product_id: l.product_id,
        product_snapshot: l.product_snapshot,
        price_per_m2: Number(l.price_per_m2),
        surface_m2: Number(l.surface_m2),
        subtotal: Number(l.subtotal),
      }))
    );

    setInitialized(true);
  }

  // ── Derived lines (igual que new/page) ───────────────────────────────────

  const derivedLines = useMemo<QuoteLineLocal[]>(() => {
    const activeProducts = products.filter((p) => p.is_active);
    if (filmMode === "SINGLE") {
      const product = activeProducts.find((p) => p.id === singleProductId);
      if (!product) return [];
      const totalM2 = glassPanes.reduce((s, p) => s + (p.width_cm / 100) * (p.height_cm / 100) * p.quantity, 0);
      const effective = priceByProduct[product.id];
      const price = Number(effective ? effective.effective_sale_price : product.sale_price_per_m2);
      const cost = Number(effective ? effective.effective_purchase_price : product.purchase_price_per_m2);
      return [{ glass_pane_ids: glassPanes.map((p) => p.pane_id), product_id: product.id, product_snapshot: { name: product.name, brand_name: "", brand_color: "#d9622c", price_per_m2: price, uv_pct: product.uv_percentage, irr_pct: product.irr_percentage, purchase_price_per_m2: cost }, price_per_m2: price, surface_m2: Math.round(totalM2 * 10000) / 10000, subtotal: Math.round(totalM2 * price * 100) / 100 }];
    } else {
      const byProduct: Record<string, { pane_ids: string[]; m2: number }> = {};
      for (const pane of glassPanes) {
        const pid = perGlassMap[pane.pane_id];
        if (!pid) continue;
        if (!byProduct[pid]) byProduct[pid] = { pane_ids: [], m2: 0 };
        byProduct[pid].pane_ids.push(pane.pane_id);
        byProduct[pid].m2 += (pane.width_cm / 100) * (pane.height_cm / 100) * pane.quantity;
      }
      return Object.entries(byProduct).map(([pid, data]) => {
        const product = activeProducts.find((p) => p.id === pid)!;
        const effective = priceByProduct[pid];
        const price = Number(effective ? effective.effective_sale_price : product.sale_price_per_m2);
        const cost = Number(effective ? effective.effective_purchase_price : product.purchase_price_per_m2);
        const m2 = Math.round(data.m2 * 10000) / 10000;
        return { glass_pane_ids: data.pane_ids, product_id: pid, product_snapshot: { name: product.name, brand_name: "", brand_color: "#d9622c", price_per_m2: price, uv_pct: product.uv_percentage, irr_pct: product.irr_percentage, purchase_price_per_m2: cost }, price_per_m2: price, surface_m2: m2, subtotal: Math.round(m2 * price * 100) / 100 };
      });
    }
  }, [filmMode, singleProductId, perGlassMap, glassPanes, products, priceByProduct]);

  const activeLines = editableLines.length > 0 ? editableLines : derivedLines;

  function goToStep3() {
    setEditableLines(derivedLines.length > 0 ? derivedLines : editableLines);
    setStep(3);
  }

  const cutPlan = useMemo(() => computeCutPlan(glassPanes, activeLines, products, gapCm), [glassPanes, activeLines, products, gapCm]);

  const canProceedStep1 = glassPanes.length > 0;
  const canProceedStep2 = filmMode === "SINGLE" ? !!singleProductId : glassPanes.every((p) => !!perGlassMap[p.pane_id]);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const today = new Date();
    const validUntil = quote?.valid_until || new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const selectedCustomer = customers.find((c) => c.id === customerId);
    const customerSnapshot = selectedCustomer
      ? { name: selectedCustomer.name, email: selectedCustomer.email ?? null, phone: selectedCustomer.phone ?? null, address: selectedCustomer.address ?? null }
      : null;

    try {
      await updateQuote.mutateAsync({
        id,
        data: {
          customer_id: customerId || null,
          customer_snapshot: customerSnapshot,
          // sale_type es inmutable — el backend ignora este valor y conserva
          // el ya persistido, se manda por completitud del tipo.
          sale_type: quote?.sale_type ?? "ARCHITECTURE",
          film_mode: filmMode,
          glass_panes: glassPanes.map((p) => ({
            pane_id: p.pane_id,
            glass_type_id: p.glass_type_id,
            glass_type_name: p.glass_type_name,
            width_cm: p.width_cm,
            height_cm: p.height_cm,
            location: p.location,
            quantity: p.quantity,
            notes: p.notes || null,
            sort_order: p.sort_order,
          })),
          lines: activeLines.map((l) => ({
            product_id: l.product_id,
            product_snapshot: l.product_snapshot,
            glass_pane_ids: l.glass_pane_ids,
            price_per_m2: l.price_per_m2,
            surface_m2: l.surface_m2,
            subtotal: l.subtotal,
          })),
          height_surcharge_pct: heightSurchargePct,
          travel_cost: travelCost,
          discount_pct: discountPct,
          tax_pct: taxPct,
          gap_cm: gapCm,
          commercial_conditions: conditions,
          cut_plan_snapshot: cutPlan as unknown as Record<string, unknown>,
          valid_until: validUntil,
        },
      });
      router.push(`/orders/${id}` as never);
    } catch (_) {
      // error visible en el botón via isPending/isError
    }
  }

  if (isPending || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
        <p className="text-[13px] text-[#94a3b8]">Cargando presupuesto...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f0f4f8]">
        <p className="text-[14px] text-[#475569]">Presupuesto no encontrado.</p>
        <Link href={"/orders" as never} className="text-[13px] text-[#d9622c] hover:underline">Volver</Link>
      </div>
    );
  }

  // sale_type es inmutable — las ventas automotrices editan con el formulario
  // simplificado (sin vidrios ni plan de cortes), nunca con el wizard de 3 pasos.
  if (quote.sale_type === "AUTOMOTIVE") {
    return (
      <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
        <header className="flex items-center gap-4 border-b border-[#e8ecf2] bg-white px-5 py-4">
          <Link
            href={`/orders/${id}` as never}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#e8ecf2] text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-[17px] font-bold text-[#0f172a]">Editar {quote.quote_number} — Automotriz</h1>
            <p className="text-[12px] text-[#94a3b8]">Los cambios reemplazan el presupuesto actual</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <AutomotiveQuoteForm initialQuote={quote} />
        </div>
      </div>
    );
  }

  // ── Inline Steps (simplified — same UI as new/page, imported via dynamic) ─
  // We render a redirect to new/page logic inline for now.
  // The full step components live in new/page.tsx; to avoid duplicating ~1200 lines
  // we use a client-side redirect trick: render the same wizard shell and delegate
  // rendering to the same Step components imported from new/page via a shared module.
  //
  // For MVP simplicity, we render a self-contained mini wizard here.

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-[#e8ecf2] bg-white px-4 py-4 sm:gap-4 sm:px-5">
        <Link
          href={`/orders/${id}` as never}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#e8ecf2] text-[#64748b] hover:bg-[#f1f5f9]"
        >
          <ArrowLeft size={15} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-bold text-[#0f172a]">Editar {quote.quote_number}</h1>
          <p className="text-[12px] text-[#94a3b8]">Los cambios reemplazan el presupuesto actual</p>
        </div>
        <div className="ml-auto">
          <StepBar step={step} />
        </div>
      </header>

      {/* Content — same layout as new/page, delegating to imported steps */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl space-y-5">

          {/* Step indicator banners */}
          {step === 1 && (
            <EditStep1
              glassPanes={glassPanes}
              setGlassPanes={setGlassPanes}
              customerId={customerId}
              setCustomerId={setCustomerId}
              customers={customers}
            />
          )}

          {step === 2 && (
            <EditStep2
              glassPanes={glassPanes}
              filmMode={filmMode}
              setFilmMode={setFilmMode}
              singleProductId={singleProductId}
              setSingleProductId={setSingleProductId}
              perGlassMap={perGlassMap}
              setPerGlassMap={setPerGlassMap}
              products={products}
            />
          )}

          {step === 3 && (
            <EditStep3
              glassPanes={glassPanes}
              lines={activeLines}
              setLines={setEditableLines}
              heightSurchargePct={heightSurchargePct}
              setHeightSurchargePct={setHeightSurchargePct}
              travelCost={travelCost}
              setTravelCost={setTravelCost}
              discountPct={discountPct}
              setDiscountPct={setDiscountPct}
              taxPct={taxPct}
              setTaxPct={setTaxPct}
              conditions={conditions}
              setConditions={setConditions}
              cutPlan={cutPlan}
              gapCm={gapCm}
              setGapCm={setGapCm}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between rounded-[14px] border border-[#e8ecf2] bg-white px-5 py-4">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
              disabled={step === 1}
              className="rounded-[10px] border border-[#dde4ee] px-4 py-2 text-[13px] font-medium text-[#475569] disabled:opacity-40 hover:bg-[#f1f5f9]"
            >
              ← Anterior
            </button>
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && canProceedStep1) setStep(2);
                  else if (step === 2 && canProceedStep2) goToStep3();
                }}
                disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
                className="flex items-center gap-2 rounded-[10px] bg-[#d9622c] px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40 hover:bg-[#b74e1e]"
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={updateQuote.isPending}
                className="flex items-center gap-2 rounded-[10px] bg-[#d9622c] px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#b74e1e]"
              >
                {updateQuote.isPending ? "Guardando..." : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline step components (simplified, same UX as new/page) ─────────────────

import { useGlassTypes } from "@/hooks/useProducts";
import { useCreateCustomer, useCustomerLabels } from "@/hooks/useCustomers";
import { Plus, Pencil, Trash2, Check, X, Layers, Users, Sun, DollarSign, Scissors, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

function EditStep1({
  glassPanes, setGlassPanes, customerId, setCustomerId, customers,
}: {
  glassPanes: GlassEntry[];
  setGlassPanes: (p: GlassEntry[]) => void;
  customerId: string;
  setCustomerId: (id: string) => void;
  customers: { id: string; name: string; phone?: string | null; address?: string | null }[];
}) {
  const { data: glassTypes = [] } = useGlassTypes();
  const { data: labels = [] } = useCustomerLabels();
  const createCustomer = useCreateCustomer();

  const [form, setForm] = useState({ glass_type_id: "", width_cm: "", height_cm: "", location: "SUPERFICIE" as LocationType, quantity: "1", notes: "" });
  const [inlineIdx, setInlineIdx] = useState<number | null>(null);
  const [inlineForm, setInlineForm] = useState({ glass_type_id: "", width_cm: "", height_cm: "", location: "SUPERFICIE" as LocationType, notes: "" });
  const [panePage, setPanePage] = useState(0);
  const PANES_PER_PAGE = 15;

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: "", phone: "", email: "", address: "", city: "", province: "", neighborhood: "", postal_code: "", label_id: "", notes: "" });
  const [newClientError, setNewClientError] = useState("");

  const totalM2 = glassPanes.reduce((s, p) => s + (p.width_cm / 100) * (p.height_cm / 100), 0);
  const hasAltura = glassPanes.some((p) => p.location === "ALTURA");

  function handleAdd() {
    const w = parseFloat(form.width_cm); const h = parseFloat(form.height_cm); const q = Math.min(parseInt(form.quantity) || 1, 50);
    if (!w || !h || !q || !form.glass_type_id) return;
    const gt = glassTypes.find((g) => g.id === form.glass_type_id);
    const base = glassPanes.length;
    const newPanes: GlassEntry[] = Array.from({ length: q }, (_, i) => ({
      pane_id: `v${String(base + i + 1).padStart(2, "0")}`,
      glass_type_id: form.glass_type_id || null,
      glass_type_name: gt?.name ?? "—",
      width_cm: w, height_cm: h, location: form.location, quantity: 1, notes: form.notes, sort_order: base + i,
    }));
    const next = [...glassPanes, ...newPanes];
    setGlassPanes(next);
    setPanePage(Math.floor((next.length - 1) / PANES_PER_PAGE));
    setForm({ glass_type_id: "", width_cm: "", height_cm: "", location: "SUPERFICIE", quantity: "1", notes: "" });
  }

  function handleInlineSave(idx: number) {
    const w = parseFloat(inlineForm.width_cm); const h = parseFloat(inlineForm.height_cm);
    if (!w || !h || !inlineForm.glass_type_id) return;
    const gt = glassTypes.find((g) => g.id === inlineForm.glass_type_id);
    const next = [...glassPanes];
    next[idx] = { ...glassPanes[idx], glass_type_id: inlineForm.glass_type_id || null, glass_type_name: gt?.name ?? "—", width_cm: w, height_cm: h, location: inlineForm.location, notes: inlineForm.notes };
    setGlassPanes(next); setInlineIdx(null);
  }

  function handleDelete(idx: number) {
    const next = glassPanes.filter((_, i) => i !== idx);
    setGlassPanes(next);
    if (inlineIdx === idx) setInlineIdx(null);
    const maxPage = Math.max(0, Math.ceil(next.length / PANES_PER_PAGE) - 1);
    if (panePage > maxPage) setPanePage(maxPage);
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const inp = "w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none";
  const cellInput = "w-full rounded-[6px] border border-[#d9622c]/40 bg-white px-1.5 py-1 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none";

  return (
    <div className="space-y-5">
      {/* Cliente */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]"><Users size={16} className="text-[#d9622c]" />Cliente</div>
          <button type="button" onClick={() => { setNewClientOpen(true); setNewClientError(""); setNewClientForm({ name: "", phone: "", email: "", address: "", city: "", province: "", neighborhood: "", postal_code: "", label_id: "", notes: "" }); }} className="flex items-center gap-1 text-[12px] font-semibold text-[#d9622c] hover:text-[#b74e1e]"><Plus size={13} />Nuevo cliente</button>
        </div>
        {newClientOpen && (
          <div className="mb-4 rounded-[10px] border border-[#d9622c]/20 bg-[#fbeee1] p-4">
            <p className="mb-4 text-[12px] font-semibold text-[#d9622c]">Crear nuevo cliente</p>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Nombre *</label><input type="text" value={newClientForm.name} onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })} placeholder="Juan Pérez" className={inp} /></div>
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Teléfono</label><input type="text" value={newClientForm.phone} onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })} placeholder="+54 9 11 ..." className={inp} /></div>
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Email</label><input type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} placeholder="juan@ejemplo.com" className={inp} /></div>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Dirección</label><input type="text" value={newClientForm.address} onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })} placeholder="Av. Corrientes 1234" className={inp} /></div>
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Barrio</label><input type="text" value={newClientForm.neighborhood} onChange={(e) => setNewClientForm({ ...newClientForm, neighborhood: e.target.value })} placeholder="Palermo" className={inp} /></div>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Ciudad</label><input type="text" value={newClientForm.city} onChange={(e) => setNewClientForm({ ...newClientForm, city: e.target.value })} className={inp} /></div>
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Provincia</label><input type="text" value={newClientForm.province} onChange={(e) => setNewClientForm({ ...newClientForm, province: e.target.value })} className={inp} /></div>
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">CP</label><input type="text" value={newClientForm.postal_code} onChange={(e) => setNewClientForm({ ...newClientForm, postal_code: e.target.value })} className={inp} /></div>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Etiqueta</label><select value={newClientForm.label_id} onChange={(e) => setNewClientForm({ ...newClientForm, label_id: e.target.value })} className={inp}><option value="">Sin etiqueta</option>{labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Notas</label><input type="text" value={newClientForm.notes} onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })} className={inp} /></div>
            </div>
            {newClientError && <p className="mb-2 text-[11px] text-red-600">{newClientError}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={createCustomer.isPending} onClick={async () => {
                if (!newClientForm.name.trim()) { setNewClientError("El nombre es obligatorio."); return; }
                if (newClientForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClientForm.email.trim())) { setNewClientError("El email no es válido."); return; }
                try {
                  const created = await createCustomer.mutateAsync({ name: newClientForm.name.trim(), phone: newClientForm.phone.trim() || null, email: newClientForm.email.trim() || null, address: newClientForm.address.trim() || null, neighborhood: newClientForm.neighborhood.trim() || null, city: newClientForm.city.trim() || null, province: newClientForm.province.trim() || null, postal_code: newClientForm.postal_code.trim() || null, label_id: newClientForm.label_id || null, notes: newClientForm.notes.trim() || null });
                  setCustomerId(created.id); setNewClientOpen(false);
                } catch (err) { setNewClientError(err instanceof Error ? err.message : "Error al crear cliente."); }
              }} className="rounded-[8px] bg-[#d9622c] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60 hover:bg-[#b74e1e]">{createCustomer.isPending ? "Guardando..." : "Guardar cliente"}</button>
              <button type="button" onClick={() => setNewClientOpen(false)} className="rounded-[8px] border border-[#dde4ee] px-4 py-1.5 text-[12px] text-[#64748b] hover:bg-[#f1f5f9]">Cancelar</button>
            </div>
          </div>
        )}
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 py-2 text-[13px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none">
          <option value="">Sin cliente asignado</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedCustomer && (
          <div className="mt-3 rounded-[10px] bg-blue-50 px-4 py-3 text-[12px] text-blue-800">
            <p className="font-semibold">{selectedCustomer.name}</p>
            {selectedCustomer.phone && <p className="text-blue-600">{selectedCustomer.phone}</p>}
            {selectedCustomer.address && <p className="text-blue-600">{selectedCustomer.address}</p>}
          </div>
        )}
      </div>

      {/* Vidrios */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]"><Layers size={16} className="text-[#d9622c]" />Vidrios del Proyecto</div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[12px] font-semibold text-[#475569]">{glassPanes.length} vidrio{glassPanes.length !== 1 ? "s" : ""}</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700">{totalM2.toFixed(2)} m²</span>
            {hasAltura && <span className="rounded-full bg-orange-100 px-3 py-1 text-[12px] font-semibold text-orange-700">Trabajo en altura</span>}
          </div>
        </div>

        <div className="rounded-[10px] bg-[#f8fafc] p-4">
          <p className="mb-3 text-[12px] font-semibold text-[#475569]">Agregar nuevo vidrio</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 sm:col-span-1"><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Tipo de Vidrio</label><select value={form.glass_type_id} onChange={(e) => setForm({ ...form, glass_type_id: e.target.value })} className={inp}><option value="">Seleccionar...</option>{glassTypes.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
            <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Ancho (cm)</label><input type="number" value={form.width_cm} onChange={(e) => setForm({ ...form, width_cm: e.target.value })} placeholder="120" className={inp} /></div>
            <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Alto (cm)</label><input type="number" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} placeholder="200" className={inp} /></div>
            <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Ubicación</label><select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value as LocationType })} className={inp}><option value="SUPERFICIE">Superficie</option><option value="ALTURA">Altura</option></select></div>
            <div><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Cantidad</label><input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inp} /></div>
          </div>
          <div className="mt-3"><label className="mb-1 block text-[11px] font-medium text-[#64748b]">Observaciones</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Observaciones del vidrio..." className="w-full resize-y rounded-[8px] border border-[#dde4ee] bg-white px-3 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none" /></div>
          <div className="mt-3">
            <button onClick={handleAdd} disabled={!form.glass_type_id || !form.width_cm || !form.height_cm} className="flex items-center gap-1.5 rounded-[8px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40 hover:bg-[#b74e1e]"><Plus size={13} />Agregar</button>
          </div>
        </div>

        {glassPanes.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-[#f1f5f9]">{["ID","Tipo","Ancho","Alto","Superficie","Ubicación","Obs.",""].map((h) => <th key={h} className="py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] first:pl-1">{h}</th>)}</tr></thead>
              <tbody>
                {glassPanes.slice(panePage * PANES_PER_PAGE, (panePage + 1) * PANES_PER_PAGE).map((p) => {
                  const idx = glassPanes.indexOf(p);
                  const isEditing = inlineIdx === idx;
                  const m2 = isEditing ? (parseFloat(inlineForm.width_cm) / 100) * (parseFloat(inlineForm.height_cm) / 100) || 0 : (p.width_cm / 100) * (p.height_cm / 100);
                  return (
                    <tr key={p.pane_id} className={`border-b border-[#f8fafc] ${isEditing ? "bg-[#fbeee1]" : ""}`}>
                      <td className="py-2 pl-1 font-bold text-[#0f172a]">{p.pane_id}</td>
                      <td className="py-2 pr-2">{isEditing ? <select value={inlineForm.glass_type_id} onChange={(e) => setInlineForm({ ...inlineForm, glass_type_id: e.target.value })} className={cellInput}><option value="">—</option>{glassTypes.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select> : <span className="rounded-[6px] bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-medium text-[#475569]">{p.glass_type_name}</span>}</td>
                      <td className="py-2 pr-2">{isEditing ? <input type="number" value={inlineForm.width_cm} onChange={(e) => setInlineForm({ ...inlineForm, width_cm: e.target.value })} className={`${cellInput} w-20`} /> : <span className="font-medium text-[#0f172a]">{p.width_cm} cm</span>}</td>
                      <td className="py-2 pr-2">{isEditing ? <input type="number" value={inlineForm.height_cm} onChange={(e) => setInlineForm({ ...inlineForm, height_cm: e.target.value })} className={`${cellInput} w-20`} /> : <span className="font-medium text-[#0f172a]">{p.height_cm} cm</span>}</td>
                      <td className="py-2 pr-3 font-semibold text-[#0f172a]">{m2.toFixed(3)} m²</td>
                      <td className="py-2 pr-2">{isEditing ? <select value={inlineForm.location} onChange={(e) => setInlineForm({ ...inlineForm, location: e.target.value as LocationType })} className={cellInput}><option value="SUPERFICIE">Superficie</option><option value="ALTURA">Altura</option></select> : <span className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${p.location === "ALTURA" ? "bg-orange-100 text-orange-700" : "bg-sky-50 text-sky-700"}`}>{p.location === "ALTURA" ? "Altura" : "Superficie"}</span>}</td>
                      <td className="py-2 pr-2">{isEditing ? <input type="text" value={inlineForm.notes} onChange={(e) => setInlineForm({ ...inlineForm, notes: e.target.value })} className={`${cellInput} w-28`} /> : <span className="text-[#94a3b8]">{p.notes || "—"}</span>}</td>
                      <td className="py-2"><div className="flex items-center gap-2">{isEditing ? (<><button onClick={() => handleInlineSave(idx)} className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#d9622c] text-white hover:bg-[#b74e1e]"><Check size={12} /></button><button onClick={() => setInlineIdx(null)} className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-[#dde4ee] text-[#64748b] hover:bg-[#f1f5f9]"><X size={12} /></button></>) : (<><button onClick={() => { setInlineIdx(idx); setInlineForm({ glass_type_id: p.glass_type_id ?? "", width_cm: String(p.width_cm), height_cm: String(p.height_cm), location: p.location, notes: p.notes }); }} className="text-[#94a3b8] hover:text-[#d9622c]"><Pencil size={13} /></button><button onClick={() => handleDelete(idx)} className="text-[#94a3b8] hover:text-red-500"><Trash2 size={13} /></button></>)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {glassPanes.length > PANES_PER_PAGE && (
              <div className="mt-3 flex items-center justify-between border-t border-[#f1f5f9] pt-3">
                <span className="text-[11px] text-[#94a3b8]">{panePage * PANES_PER_PAGE + 1}–{Math.min((panePage + 1) * PANES_PER_PAGE, glassPanes.length)} de {glassPanes.length}</span>
                <div className="flex items-center gap-1">
                  <button disabled={panePage === 0} onClick={() => setPanePage((p) => p - 1)} className="rounded-[6px] border border-[#dde4ee] px-2.5 py-1 text-[11px] font-medium text-[#475569] disabled:opacity-40 hover:bg-[#f1f5f9]">‹ Anterior</button>
                  {Array.from({ length: Math.ceil(glassPanes.length / PANES_PER_PAGE) }, (_, i) => <button key={i} onClick={() => setPanePage(i)} className={`h-6 w-6 rounded-[6px] text-[11px] font-semibold ${panePage === i ? "bg-[#d9622c] text-white" : "border border-[#dde4ee] text-[#475569] hover:bg-[#f1f5f9]"}`}>{i + 1}</button>)}
                  <button disabled={panePage >= Math.ceil(glassPanes.length / PANES_PER_PAGE) - 1} onClick={() => setPanePage((p) => p + 1)} className="rounded-[6px] border border-[#dde4ee] px-2.5 py-1 text-[11px] font-medium text-[#475569] disabled:opacity-40 hover:bg-[#f1f5f9]">Siguiente ›</button>
                </div>
              </div>
            )}
          </div>
        )}
        {glassPanes.length === 0 && <p className="mt-4 text-center text-[13px] text-[#94a3b8]">Agregá al menos un vidrio para continuar.</p>}
      </div>
    </div>
  );
}

function EditStep2({
  glassPanes, filmMode, setFilmMode, singleProductId, setSingleProductId, perGlassMap, setPerGlassMap, products,
}: {
  glassPanes: GlassEntry[];
  filmMode: FilmMode;
  setFilmMode: (m: FilmMode) => void;
  singleProductId: string;
  setSingleProductId: (id: string) => void;
  perGlassMap: Record<string, string>;
  setPerGlassMap: (m: Record<string, string>) => void;
  products: Product[];
}) {
  const { data: session } = useSession();
  const activeProducts = products.filter((p) => p.is_active);
  const { data: priceList = [] } = useEffectivePriceList(session?.userId);
  const priceByProduct = useMemo(
    () => Object.fromEntries(priceList.map((i) => [i.product_id, i.effective_sale_price])),
    [priceList]
  );
  function effectiveSalePrice(p: Product): number {
    const override = priceByProduct[p.id];
    return Number(override ?? p.sale_price_per_m2);
  }

  const glassTypeNames = [...new Set(glassPanes.map((p) => p.glass_type_name))].join(", ");

  const materialSummary = useMemo(() => {
    const map: Record<string, { product: Product; panes: GlassEntry[]; m2: number }> = {};
    for (const pane of glassPanes) {
      const pid = perGlassMap[pane.pane_id];
      if (!pid) continue;
      const product = activeProducts.find((p) => p.id === pid);
      if (!product) continue;
      if (!map[pid]) map[pid] = { product, panes: [], m2: 0 };
      map[pid].panes.push(pane);
      map[pid].m2 += (pane.width_cm / 100) * (pane.height_cm / 100) * pane.quantity;
    }
    return Object.values(map);
  }, [glassPanes, perGlassMap, activeProducts]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setFilmMode("SINGLE")}
          className={`flex items-center justify-center gap-2 rounded-[12px] border-2 px-4 py-3 text-[13px] font-semibold transition-all ${filmMode === "SINGLE" ? "border-[#d9622c] bg-[#fbeee1] text-[#d9622c]" : "border-[#e8ecf2] bg-white text-[#475569] hover:border-[#ead9c8]"}`}
        >
          <Sun size={15} />
          Una sola lámina para todos los vidrios
        </button>
        <button
          onClick={() => setFilmMode("PER_GLASS")}
          className={`flex items-center justify-center gap-2 rounded-[12px] border-2 px-4 py-3 text-[13px] font-semibold transition-all ${filmMode === "PER_GLASS" ? "border-[#d9622c] bg-[#fbeee1] text-[#d9622c]" : "border-[#e8ecf2] bg-white text-[#475569] hover:border-[#ead9c8]"}`}
        >
          <Layers size={15} />
          Láminas distintas por vidrio
        </button>
      </div>

      {filmMode === "SINGLE" ? (
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#0f172a]">
            <Sun size={14} className="text-amber-500" />
            Seleccionar Lámina
          </div>
          <p className="mb-3 text-[12px] text-[#94a3b8]">Vidrios: {glassTypeNames}</p>
          <div className="space-y-2">
            {activeProducts.map((p) => {
              const selected = p.id === singleProductId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSingleProductId(p.id)}
                  className={`w-full rounded-[10px] border-2 px-4 py-3 text-left transition-all ${selected ? "border-[#d9622c] bg-[#fbeee1]" : "border-[#e8ecf2] bg-white hover:border-[#ead9c8]"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sun size={14} className="shrink-0 text-amber-500" />
                      <div>
                        <p className="text-[13px] font-semibold text-[#0f172a]">{p.name}</p>
                        <p className="text-[11px] text-[#94a3b8]">
                          ${effectiveSalePrice(p).toLocaleString("es-AR")}/m²&nbsp;&nbsp;UV {p.uv_percentage}%&nbsp;&nbsp;IRR {p.irr_percentage}%
                        </p>
                      </div>
                    </div>
                    {selected ? <ChevronUp size={14} className="text-[#d9622c]" /> : <ChevronDown size={14} className="text-[#94a3b8]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
          <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-[#0f172a]">
            <Layers size={14} className="text-[#d9622c]" />
            Asignar lámina por vidrio
          </div>
          <p className="mb-4 text-[12px] text-[#94a3b8]">Cada vidrio puede tener una lámina diferente</p>

          <div className="overflow-hidden rounded-[10px] border border-[#e8ecf2]">
            <div className="grid grid-cols-[60px_1fr_200px] border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
              <span>Vidrio</span>
              <span>Medidas</span>
              <span>Lámina asignada</span>
            </div>
            {glassPanes.map((pane) => (
              <div key={pane.pane_id} className="grid grid-cols-[60px_1fr_200px] items-center border-b border-[#f8fafc] px-4 py-3">
                <span className="text-[13px] font-bold text-[#0f172a]">{pane.pane_id}</span>
                <div>
                  <span className="text-[12px] text-[#475569]">
                    {pane.width_cm} × {pane.height_cm} cm
                  </span>
                  <span className="ml-2 rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] text-[#64748b]">
                    {pane.glass_type_name}
                  </span>
                </div>
                <select
                  value={perGlassMap[pane.pane_id] ?? ""}
                  onChange={(e) => setPerGlassMap({ ...perGlassMap, [pane.pane_id]: e.target.value })}
                  className="rounded-[8px] border border-[#dde4ee] bg-white px-2 py-1.5 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
                >
                  <option value="">Seleccionar lámina...</option>
                  {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${effectiveSalePrice(p).toLocaleString("es-AR")}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {materialSummary.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {materialSummary.map((ms) => (
                <span key={ms.product.id} className="flex items-center gap-1.5 rounded-full border border-[#e8ecf2] bg-[#f8fafc] px-3 py-1 text-[11px] font-medium text-[#475569]">
                  <Sun size={10} className="text-amber-500" />
                  {ms.product.name} · {ms.panes.length} vidrio{ms.panes.length !== 1 ? "s" : ""} · {ms.m2.toFixed(2)} m²
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function calcTotals(lines: QuoteLineLocal[], panes: GlassEntry[], hPct: number, travel: number, disc: number, taxP: number) {
  const alturaIds = new Set(panes.filter((p) => p.location === "ALTURA").map((p) => p.pane_id));
  let materials = 0; let heightSurcharge = 0;
  for (const l of lines) {
    materials += l.subtotal;
    const alturaCost = panes.filter((p) => alturaIds.has(p.pane_id) && l.glass_pane_ids.includes(p.pane_id)).reduce((s, p) => s + (p.width_cm / 100) * (p.height_cm / 100) * l.price_per_m2, 0);
    heightSurcharge += alturaCost * (hPct / 100);
  }
  const subtotal = materials + heightSurcharge + travel;
  const discountAmount = Math.round(subtotal * disc) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * taxP) / 100;
  const total = taxableAmount + taxAmount;

  let margin: number | null = 0;
  for (const l of lines) {
    const rawCost = l.product_snapshot?.purchase_price_per_m2;
    if (margin === null) continue;
    if (rawCost == null || (typeof rawCost !== "number" && typeof rawCost !== "string") || isNaN(Number(rawCost))) {
      margin = null;
      continue;
    }
    margin += (l.price_per_m2 - Number(rawCost)) * l.surface_m2;
  }
  if (margin !== null) margin = Math.round(margin * 100) / 100;

  return { materials, heightSurcharge, travel, subtotal, discountAmount, taxAmount, total, margin };
}

function EditStep3({
  glassPanes, lines, setLines, heightSurchargePct, setHeightSurchargePct,
  travelCost, setTravelCost, discountPct, setDiscountPct, taxPct, setTaxPct, conditions, setConditions, cutPlan, gapCm, setGapCm,
}: {
  glassPanes: GlassEntry[];
  lines: QuoteLineLocal[];
  setLines: (l: QuoteLineLocal[]) => void;
  heightSurchargePct: number; setHeightSurchargePct: (v: number) => void;
  travelCost: number; setTravelCost: (v: number) => void;
  discountPct: number; setDiscountPct: (v: number) => void;
  taxPct: number; setTaxPct: (v: number) => void;
  conditions: string; setConditions: (v: string) => void;
  cutPlan: CutPlan;
  gapCm: number; setGapCm: (v: number) => void;
}) {
  const hasAltura = glassPanes.some((p) => p.location === "ALTURA");
  const totals = calcTotals(lines, glassPanes, heightSurchargePct, travelCost, discountPct, taxPct);
  const totalM2 = glassPanes.reduce((s, p) => s + (p.width_cm / 100) * (p.height_cm / 100), 0);
  const [cutPlanOpen, setCutPlanOpen] = useState(false);

  function updatePrice(productId: string, newPrice: number) {
    setLines(lines.map((l) => l.product_id === productId ? { ...l, price_per_m2: newPrice, subtotal: Math.round(l.surface_m2 * newPrice * 100) / 100 } : l));
  }

  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
  const inp3 = "rounded-[8px] border border-[#dde4ee] bg-white px-3 py-2 text-[13px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none";

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4 text-center"><p className="text-[24px] font-bold text-[#d9622c]">{glassPanes.length}</p><p className="text-[12px] text-[#94a3b8]">Vidrios</p></div>
        <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4 text-center"><p className="text-[24px] font-bold text-blue-600">{totalM2.toFixed(1)}</p><p className="text-[12px] text-[#94a3b8]">m²</p></div>
        <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4 text-center"><p className="text-[24px] font-bold text-[#0f172a]">{lines.length}</p><p className="text-[12px] text-[#94a3b8]">Materiales</p></div>
      </div>

      {/* Precios por material */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]"><DollarSign size={16} className="text-[#d9622c]" />Precio por material</div>
        {lines.map((l) => {
          const snap = l.product_snapshot as Record<string, string | number>;
          return (
            <div key={l.product_id} className="mb-3 rounded-[10px] bg-[#f8fafc] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#0f172a]">{String(snap.name ?? l.product_id)}</span>
                <span className="text-[12px] text-[#94a3b8]">{l.surface_m2.toFixed(2)} m²</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#64748b]">$/m²</span>
                <input type="number" value={l.price_per_m2} onChange={(e) => updatePrice(l.product_id, parseFloat(e.target.value) || 0)} className={`${inp3} w-36`} />
                <span className="ml-auto text-[13px] font-semibold text-[#0f172a]">{fmt(l.subtotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recargo altura — stepper */}
      {hasAltura && (
        <div className="flex items-center justify-between rounded-[12px] border border-orange-100 bg-orange-50 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-orange-700">↑ Trabajo en altura</p>
            <p className="text-[11px] text-orange-400">Recargo sobre vidrios en altura</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setHeightSurchargePct(Math.max(0, heightSurchargePct - 5))} className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-orange-100 text-[16px] font-bold text-orange-700 hover:bg-orange-200">−</button>
            <div className="w-14 text-center">
              <span className="text-[18px] font-bold text-orange-700">{heightSurchargePct}</span>
              <span className="text-[12px] text-orange-500">%</span>
            </div>
            <button type="button" onClick={() => setHeightSurchargePct(Math.min(100, heightSurchargePct + 5))} className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-orange-100 text-[16px] font-bold text-orange-700 hover:bg-orange-200">+</button>
            <span className="ml-3 min-w-[70px] text-right text-[13px] font-bold text-orange-600">{fmt(totals.heightSurcharge)}</span>
          </div>
        </div>
      )}

      {/* Viáticos — chips de presets */}
      <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-blue-50 text-[14px]">🚗</span>
            <span className="text-[13px] font-semibold text-[#0f172a]">Viáticos / Desplazamiento</span>
          </div>
          <span className="text-[14px] font-bold text-[#0f172a]">{fmt(travelCost)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 500, 1000, 2000, 5000].map((v) => (
            <button key={v} type="button" onClick={() => setTravelCost(v)} className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all ${travelCost === v ? "bg-blue-600 text-white shadow-sm" : "bg-[#f1f5f9] text-[#475569] hover:bg-blue-50 hover:text-blue-700"}`}>
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

      {/* Subtotal */}
      <div className="flex items-center justify-between rounded-[10px] bg-[#f8fafc] px-4 py-3">
        <p className="text-[13px] font-semibold text-[#475569]">Subtotal</p>
        <p className="text-[15px] font-bold text-[#0f172a]">{fmt(totals.subtotal)}</p>
      </div>

      {/* Descuento / Recargo — toggle + chips */}
      <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#0f172a]">Ajuste de precio</span>
          {discountPct !== 0 && (
            <span className={`text-[13px] font-bold ${discountPct > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {discountPct > 0 ? `−${fmt(totals.discountAmount)}` : `+${fmt(Math.abs(totals.discountAmount))}`}
            </span>
          )}
        </div>
        <div className="mb-3 flex rounded-[10px] bg-[#f1f5f9] p-1">
          <button type="button" onClick={() => { if (discountPct < 0) setDiscountPct(-discountPct); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-[12px] font-semibold transition-all ${discountPct >= 0 ? "bg-white text-emerald-700 shadow-sm" : "text-[#94a3b8] hover:text-[#475569]"}`}>
            <span>🏷️</span> Descuento
          </button>
          <button type="button" onClick={() => { if (discountPct > 0) setDiscountPct(-discountPct); else if (discountPct === 0) setDiscountPct(-1); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-[12px] font-semibold transition-all ${discountPct < 0 ? "bg-white text-red-600 shadow-sm" : "text-[#94a3b8] hover:text-[#475569]"}`}>
            <span>📈</span> Recargo
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 5, 10, 15, 20].map((v) => {
            const actual = discountPct < 0 ? -v : v;
            const isActive = v === 0 ? discountPct === 0 : discountPct === actual;
            return (
              <button key={v} type="button" onClick={() => setDiscountPct(discountPct < 0 ? -v : v)} className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all ${isActive ? (discountPct <= 0 ? "bg-red-500 text-white shadow-sm" : "bg-emerald-600 text-white shadow-sm") : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e8ecf2]"}`}>
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
          <button type="button" onClick={() => setTaxPct(0)} className={`rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition-all ${taxPct === 0 ? "bg-[#475569] text-white shadow-sm" : "border border-[#dde4ee] bg-white text-[#94a3b8] hover:border-[#475569] hover:text-[#475569]"}`}>Sin IVA</button>
          <button type="button" onClick={() => setTaxPct(21)} className={`rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition-all ${taxPct === 21 ? "bg-violet-600 text-white shadow-sm" : "border border-[#dde4ee] bg-white text-[#94a3b8] hover:border-violet-400 hover:text-violet-600"}`}>IVA 21%</button>
          {taxPct > 0 && <span className="min-w-[70px] text-right text-[13px] font-bold text-violet-700">+{fmt(totals.taxAmount)}</span>}
        </div>
      </div>

      {/* Margen */}
      {totals.margin != null && (
        <div className="flex items-center justify-between rounded-[8px] bg-emerald-50 px-3 py-2">
          <span className="text-[12px] font-medium text-emerald-700">
            Margen
            {totals.materials > 0 && (
              <span className="ml-1 text-[11px] text-emerald-600">
                ({((totals.margin / totals.materials) * 100).toFixed(1)}%)
              </span>
            )}
          </span>
          <span className="text-[13px] font-bold text-emerald-700">
            $ {Math.round(totals.margin).toLocaleString("es-AR")}
          </span>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between rounded-[12px] bg-[#d9622c] px-5 py-4">
        <div className="space-y-0.5">
          <p className="text-[14px] font-bold tracking-wide text-white">TOTAL</p>
          {hasAltura && totals.heightSurcharge > 0 && <p className="text-[11px] text-white/70">Inc. recargo altura {heightSurchargePct}%</p>}
          {travelCost > 0 && <p className="text-[11px] text-white/70">Inc. viáticos $ {Math.round(travelCost).toLocaleString("es-AR")}</p>}
          {discountPct !== 0 && <p className="text-[11px] text-white/70">{discountPct > 0 ? `Desc. ${discountPct}%` : `Recargo ${Math.abs(discountPct)}%`}</p>}
          {taxPct > 0 && <p className="text-[11px] text-white/70">IVA {taxPct}% inc.</p>}
        </div>
        <p className="text-[22px] font-bold text-white">{fmt(totals.total)}</p>
      </div>

      {/* Plan de corte */}
      {cutPlan.materials.length > 0 && (
        <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
          <button
            type="button"
            onClick={() => setCutPlanOpen((o) => !o)}
            className={`flex w-full flex-wrap items-center justify-between gap-3 text-left ${cutPlanOpen ? "mb-4" : ""}`}
          >
            <span className="flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]">
              <Scissors size={15} className="text-purple-600" />
              Cálculo de Cortes
              {cutPlan.materials.length > 1 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700">{cutPlan.materials.length} Materiales</span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <label
                className="flex items-center gap-2 text-[12px] text-[#64748b]"
                onClick={(e) => e.stopPropagation()}
              >
                Espacio entre cortes
                <input
                  type="number" min="0" step="0.5"
                  value={gapCm}
                  onChange={(e) => setGapCm(Number(e.target.value))}
                  className="w-16 rounded-[8px] border border-[#dde4ee] bg-[#f8fafc] px-2 py-1 text-center text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
                />
                <span className="text-[11px]">cm</span>
              </label>
              <ChevronDown
                size={16}
                className={`text-[#94a3b8] transition-transform ${cutPlanOpen ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          {cutPlanOpen && cutPlan.materials.map((m, mi) => {
            const matPaneIds = lines.find((l) => l.product_id === m.product_id)?.glass_pane_ids ?? [];
            return (
              <div key={m.product_id} className={mi > 0 ? "mt-5 border-t border-[#f1f5f9] pt-5" : ""}>
                {cutPlan.materials.length > 1 && (
                  <p className="mb-3 text-[12px] font-semibold" style={{ color: m.brand_color }}>Lámina {mi + 1}: {m.product_name}</p>
                )}
                <div className="mb-3 grid grid-cols-4 gap-2">
                  <div className="rounded-[10px] bg-[#f0f4f8] p-3 text-center">
                    <p className="text-[16px] font-bold text-[#0f172a]">{m.linear_m}m</p>
                    <p className="text-[10px] text-[#94a3b8]">Metros Lineales</p>
                  </div>
                  <div className="rounded-[10px] bg-emerald-50 p-3 text-center">
                    <p className="text-[16px] font-bold text-emerald-700">{m.rolls}</p>
                    <p className="text-[10px] text-[#94a3b8]">Rollo{m.rolls !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="rounded-[10px] bg-[#f0f4f8] p-3 text-center">
                    <p className="text-[16px] font-bold text-[#0f172a]">{m.efficiency_pct}%</p>
                    <p className="text-[10px] text-[#94a3b8]">Eficiencia</p>
                  </div>
                  <div className="rounded-[10px] bg-amber-50 p-3 text-center">
                    <p className="text-[14px] font-bold text-amber-600">{m.area_useful_m2}m²</p>
                    <p className="text-[10px] text-[#94a3b8]">Área Útil</p>
                  </div>
                </div>
                {m.cuts.length > 0 && <CutDiagram rows={m.cuts} rollWidthCm={m.roll_width_cm} paneIds={matPaneIds} gapCm={gapCm} />}
              </div>
            );
          })}
          {cutPlanOpen && cutPlan.materials.some((m) => m.cuts.some((r) => r.pieces.some((p) => p.pano_total && p.pano_total > 1))) && (
            <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              <AlertTriangle size={13} />
              Algunos vidrios superan el ancho del rollo y serán divididos en paños.
            </div>
          )}
        </div>
      )}

      {/* Condiciones comerciales */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <label className="mb-2 block text-[13px] font-semibold text-[#0f172a]">Condiciones comerciales</label>
        <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={4} className="w-full resize-y rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none" />
      </div>
    </div>
  );
}
