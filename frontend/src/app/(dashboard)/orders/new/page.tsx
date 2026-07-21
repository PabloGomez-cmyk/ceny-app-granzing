"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Pencil,
  AlertTriangle,
  Layers,
  Sun,
  DollarSign,
  Scissors,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { useGlassTypes } from "@/hooks/useProducts";
import { useCreateQuote } from "@/hooks/useQuotes";
import { useUser } from "@/hooks/useUsers";
import type { LocationType, FilmMode, GlassPaneInput, QuoteLineInput, SaleType } from "@/lib/api/quotes";
import type { Product } from "@/lib/api/products";
import { CutDiagram, type CutPiece, type CutRow } from "@/components/quotes/CutDiagram";
import { useEffectivePriceList } from "@/hooks/usePriceLists";
import { CustomerPicker } from "@/components/quotes/CustomerPicker";
import { SaleTypeSelector } from "@/components/quotes/SaleTypeSelector";
import { AutomotiveQuoteForm } from "@/components/quotes/AutomotiveQuoteForm";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CONDITIONS =
  "Presupuesto válido por 15 días.\nForma de pago: 50% anticipo, 50% contra entrega.\nGarantía según especificaciones del fabricante.";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  roll_width_cm: number;
  roll_length_m: number;
  linear_m: number;
  rolls: number;
  efficiency_pct: number;
  area_useful_m2: number;
  cuts: CutRow[];
}

interface CutPlan {
  materials: MaterialCutPlan[];
  total_linear_m: number;
  total_rolls: number;
}

// ── Cut plan algorithm ────────────────────────────────────────────────────────

function computeCutPlan(
  glassPanes: GlassEntry[],
  lines: QuoteLineLocal[],
  products: import("@/lib/api/products").Product[],
  gapCm: number
): CutPlan {
  const materials: MaterialCutPlan[] = [];

  for (const line of lines) {
    const product = products.find((p) => p.id === line.product_id);
    const rollWidthCm = product?.roll_width_cm ?? 152;
    const rollLengthM = product?.roll_length_m ?? 30;

    const paneIds = new Set(line.glass_pane_ids);
    const assignedPanes = glassPanes.filter((p) => paneIds.has(p.pane_id));

    const pieces: CutPiece[] = [];
    for (const pane of assignedPanes) {
      for (let q = 0; q < pane.quantity; q++) {
        // Las dimensiones efectivas incluyen el espacio entre cortes
        let w = pane.width_cm + gapCm;
        let h = pane.height_cm + gapCm;
        let rotated = false;

        if (w > rollWidthCm && h <= rollWidthCm) {
          [w, h] = [h, w];
          rotated = true;
        }

        if (w <= rollWidthCm) {
          pieces.push({
            pane_id: pane.pane_id,
            label: pane.pane_id + (pane.quantity > 1 ? `-${q + 1}` : ""),
            // Guardamos dimensiones reales (sin gap) para mostrar en el diagrama
            width_cm: w - gapCm,
            height_cm: h - gapCm,
            rotated,
          });
        } else {
          const numPanos = Math.ceil(w / rollWidthCm);
          for (let pi = 0; pi < numPanos; pi++) {
            const pw = pi === numPanos - 1 ? w - rollWidthCm * (numPanos - 1) : rollWidthCm;
            pieces.push({
              pane_id: pane.pane_id,
              label: `${pane.pane_id}-P${pi + 1}`,
              width_cm: pw - gapCm,
              height_cm: h - gapCm,
              rotated,
              pano_index: pi + 1,
              pano_total: numPanos,
            });
          }
        }
      }
    }

    // Shelf packing usando dimensiones con gap para el cálculo de espacio
    const sorted = [...pieces].sort((a, b) => b.height_cm - a.height_cm);
    const rows: CutRow[] = [];
    let currentRow: CutPiece[] = [];
    let currentWidth = 0;
    let currentHeight = 0;

    for (const piece of sorted) {
      const pieceW = piece.width_cm + gapCm;
      const pieceH = piece.height_cm + gapCm;
      if (currentWidth + pieceW <= rollWidthCm) {
        currentRow.push(piece);
        currentWidth += pieceW;
        currentHeight = Math.max(currentHeight, pieceH);
      } else {
        if (currentRow.length > 0) {
          rows.push({ pieces: currentRow, row_height_cm: currentHeight, used_width_cm: currentWidth });
        }
        currentRow = [piece];
        currentWidth = pieceW;
        currentHeight = pieceH;
      }
    }
    if (currentRow.length > 0) {
      rows.push({ pieces: currentRow, row_height_cm: currentHeight, used_width_cm: currentWidth });
    }

    const totalLinearCm = rows.reduce((s, r) => s + r.row_height_cm, 0);
    const totalLinearM = totalLinearCm / 100;
    const rolls = Math.ceil(totalLinearM / rollLengthM);
    const usefulArea = line.surface_m2;
    const rollArea = totalLinearM * (rollWidthCm / 100);
    const efficiency = rollArea > 0 ? (usefulArea / rollArea) * 100 : 0;

    const snap = line.product_snapshot as Record<string, string | number>;
    materials.push({
      product_id: line.product_id,
      product_name: String(snap.name ?? ""),
      brand_name: String(snap.brand_name ?? ""),
      brand_color: String(snap.brand_color ?? "#d9622c"),
      roll_width_cm: rollWidthCm,
      roll_length_m: rollLengthM,
      linear_m: Math.round(totalLinearM * 1000) / 1000,
      rolls,
      efficiency_pct: Math.round(efficiency * 10) / 10,
      area_useful_m2: Math.round(usefulArea * 1000) / 1000,
      cuts: rows,
    });
  }

  const total_linear_m = materials.reduce((s, m) => s + m.linear_m, 0);
  const total_rolls = Math.max(...materials.map((m) => m.rolls), 0);

  return { materials, total_linear_m: Math.round(total_linear_m * 1000) / 1000, total_rolls };
}

// ── Financial helpers ─────────────────────────────────────────────────────────

function calcTotals(
  lines: {
    glass_pane_ids: string[];
    price_per_m2: number;
    surface_m2: number;
    subtotal: number;
    product_snapshot?: Record<string, unknown>;
  }[],
  glassPanes: GlassEntry[],
  heightSurchargePct: number,
  travelCost: number,
  discountPct: number,
  taxPct: number
) {
  const materialsSub = lines.reduce((s, l) => s + l.subtotal, 0);

  const alturaPaneIds = new Set(glassPanes.filter((p) => p.location === "ALTURA").map((p) => p.pane_id));
  let heightBase = 0;
  for (const line of lines) {
    for (const pid of line.glass_pane_ids) {
      if (alturaPaneIds.has(pid)) {
        const pane = glassPanes.find((p) => p.pane_id === pid);
        if (pane) {
          const m2 = (pane.width_cm / 100) * (pane.height_cm / 100) * pane.quantity;
          heightBase += m2 * line.price_per_m2;
        }
      }
    }
  }
  const heightSurcharge = Math.round(heightBase * heightSurchargePct) / 100;
  const subtotal = materialsSub + heightSurcharge + travelCost;
  const discountAmount = Math.round(subtotal * discountPct) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * taxPct) / 100;
  const total = taxableAmount + taxAmount;

  let margin: number | null = 0;
  for (const line of lines) {
    const rawCost = line.product_snapshot?.purchase_price_per_m2;
    if (margin === null) continue;
    if (rawCost == null || (typeof rawCost !== "number" && typeof rawCost !== "string") || isNaN(Number(rawCost))) {
      margin = null;
      continue;
    }
    margin += (line.price_per_m2 - Number(rawCost)) * line.surface_m2;
  }
  if (margin !== null) margin = Math.round(margin * 100) / 100;

  return { materialsSub, heightSurcharge, subtotal, discountAmount, taxAmount, total, margin };
}

function fmt(n: number) {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Medidas" },
    { n: 2, label: "Lámina" },
    { n: 3, label: "Confirmar" },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = s.n < step;
        const active = s.n === step;
        return (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold sm:px-3 ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-[#d9622c] text-white" : "bg-[#f1f5f9] text-[#94a3b8]"}`}>
              {done ? <Check size={11} /> : <span className="text-[11px]">{s.n}</span>}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <ArrowRight size={12} className="hidden text-[#cbd5e1] sm:block" />}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Medidas ───────────────────────────────────────────────────────────

function Step1({
  glassPanes,
  setGlassPanes,
  customerId,
  setCustomerId,
}: {
  glassPanes: GlassEntry[];
  setGlassPanes: (p: GlassEntry[]) => void;
  customerId: string;
  setCustomerId: (id: string) => void;
}) {
  const { data: glassTypes = [] } = useGlassTypes();

  const [form, setForm] = useState<{
    glass_type_id: string;
    width_cm: string;
    height_cm: string;
    location: LocationType;
    quantity: string;
    notes: string;
  }>({ glass_type_id: "", width_cm: "", height_cm: "", location: "SUPERFICIE", quantity: "1", notes: "" });
  const [editIdx, setEditIdx] = useState<number | null>(null);

  // Inline row editing
  const [inlineIdx, setInlineIdx] = useState<number | null>(null);
  const [inlineForm, setInlineForm] = useState<{
    glass_type_id: string; width_cm: string; height_cm: string;
    location: LocationType; notes: string;
  }>({ glass_type_id: "", width_cm: "", height_cm: "", location: "SUPERFICIE", notes: "" });

  const totalM2 = glassPanes.reduce((s, p) => s + (p.width_cm / 100) * (p.height_cm / 100) * p.quantity, 0);
  const totalPanes = glassPanes.length;
  const hasAltura = glassPanes.some((p) => p.location === "ALTURA");

  const PANES_PER_PAGE = 15;
  const [panePage, setPanePage] = useState(0);

  function handleAdd() {
    const w = parseFloat(form.width_cm);
    const h = parseFloat(form.height_cm);
    const q = Math.min(parseInt(form.quantity) || 1, 50);
    if (!w || !h || !q || !form.glass_type_id) return;

    const gt = glassTypes.find((g) => g.id === form.glass_type_id);

    if (editIdx !== null) {
      const entry: GlassEntry = {
        pane_id: glassPanes[editIdx].pane_id,
        glass_type_id: form.glass_type_id || null,
        glass_type_name: gt?.name ?? "—",
        width_cm: w,
        height_cm: h,
        location: form.location,
        quantity: 1,
        notes: form.notes,
        sort_order: glassPanes[editIdx].sort_order,
      };
      const next = [...glassPanes];
      next[editIdx] = entry;
      setGlassPanes(next);
      setEditIdx(null);
    } else {
      const base = glassPanes.length;
      const newPanes: GlassEntry[] = Array.from({ length: q }, (_, i) => ({
        pane_id: `v${String(base + i + 1).padStart(2, "0")}`,
        glass_type_id: form.glass_type_id || null,
        glass_type_name: gt?.name ?? "—",
        width_cm: w,
        height_cm: h,
        location: form.location,
        quantity: 1,
        notes: form.notes,
        sort_order: base + i,
      }));
      const next = [...glassPanes, ...newPanes];
      setGlassPanes(next);
      // Ir a la última página para que el usuario vea los vidrios recién agregados
      setPanePage(Math.floor((next.length - 1) / PANES_PER_PAGE));
    }
    setForm({ glass_type_id: "", width_cm: "", height_cm: "", location: "SUPERFICIE", quantity: "1", notes: "" });
  }

  function handleEdit(idx: number) {
    const p = glassPanes[idx];
    setInlineIdx(idx);
    setInlineForm({
      glass_type_id: p.glass_type_id ?? "",
      width_cm: String(p.width_cm),
      height_cm: String(p.height_cm),
      location: p.location,
      notes: p.notes,
    });
  }

  function handleInlineSave(idx: number) {
    const w = parseFloat(inlineForm.width_cm);
    const h = parseFloat(inlineForm.height_cm);
    if (!w || !h || !inlineForm.glass_type_id) return;
    const gt = glassTypes.find((g) => g.id === inlineForm.glass_type_id);
    const next = [...glassPanes];
    next[idx] = {
      ...glassPanes[idx],
      glass_type_id: inlineForm.glass_type_id || null,
      glass_type_name: gt?.name ?? "—",
      width_cm: w,
      height_cm: h,
      location: inlineForm.location,
      notes: inlineForm.notes,
    };
    setGlassPanes(next);
    setInlineIdx(null);
  }

  function handleDelete(idx: number) {
    const next = glassPanes.filter((_, i) => i !== idx);
    setGlassPanes(next);
    if (editIdx === idx) setEditIdx(null);
    if (inlineIdx === idx) setInlineIdx(null);
    const maxPage = Math.max(0, Math.ceil(next.length / PANES_PER_PAGE) - 1);
    if (panePage > maxPage) setPanePage(maxPage);
  }

  return (
    <div className="space-y-5">
      <CustomerPicker customerId={customerId} setCustomerId={setCustomerId} />

      {/* Glass panes */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]">
            <Layers size={16} className="text-[#d9622c]" />
            Vidrios del Proyecto
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[12px] font-semibold text-[#475569]">
              {totalPanes} vidrio{totalPanes !== 1 ? "s" : ""}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700">
              {totalM2.toFixed(2)} m²
            </span>
            {hasAltura && (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-[12px] font-semibold text-orange-700">
                Trabajo en altura
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="rounded-[10px] bg-[#f8fafc] p-4">
          <p className="mb-3 text-[12px] font-semibold text-[#475569]">Agregar nuevo vidrio</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Tipo de Vidrio</label>
              <select
                value={form.glass_type_id}
                onChange={(e) => setForm({ ...form, glass_type_id: e.target.value })}
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                {glassTypes.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Ancho (cm)</label>
              <input
                type="number"
                value={form.width_cm}
                onChange={(e) => setForm({ ...form, width_cm: e.target.value })}
                placeholder="120"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Alto (cm)</label>
              <input
                type="number"
                value={form.height_cm}
                onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                placeholder="200"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Ubicación</label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value as LocationType })}
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
              >
                <option value="SUPERFICIE">Superficie</option>
                <option value="ALTURA">Altura</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Cantidad</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Observaciones</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Observaciones del vidrio..."
              className="w-full resize-y rounded-[8px] border border-[#dde4ee] bg-white px-3 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={!form.glass_type_id || !form.width_cm || !form.height_cm}
              className="flex items-center gap-1.5 rounded-[8px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40 hover:bg-[#b74e1e]"
            >
              <Plus size={13} />
              Agregar
            </button>
          </div>
        </div>

        {/* Table */}
        {glassPanes.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  {["ID", "Tipo", "Ancho", "Alto", "Superficie", "Ubicación", "Obs.", ""].map((h) => (
                    <th key={h} className="py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] first:pl-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {glassPanes.slice(panePage * PANES_PER_PAGE, (panePage + 1) * PANES_PER_PAGE).map((p) => {
                  const idx = glassPanes.indexOf(p);
                  const isEditing = inlineIdx === idx;
                  const m2 = isEditing
                    ? (parseFloat(inlineForm.width_cm) / 100) * (parseFloat(inlineForm.height_cm) / 100) || 0
                    : (p.width_cm / 100) * (p.height_cm / 100);

                  const cellInput = "w-full rounded-[6px] border border-[#d9622c]/40 bg-white px-1.5 py-1 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none";

                  return (
                    <tr key={p.pane_id} className={`border-b border-[#f8fafc] ${isEditing ? "bg-[#fbeee1]" : ""}`}>
                      <td className="py-2 pl-1 font-bold text-[#0f172a]">{p.pane_id}</td>

                      {/* Tipo */}
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <select
                            value={inlineForm.glass_type_id}
                            onChange={(e) => setInlineForm({ ...inlineForm, glass_type_id: e.target.value })}
                            className={cellInput}
                          >
                            <option value="">—</option>
                            {glassTypes.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                        ) : (
                          <span className="rounded-[6px] bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-medium text-[#475569]">
                            {p.glass_type_name}
                          </span>
                        )}
                      </td>

                      {/* Ancho */}
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <input type="number" value={inlineForm.width_cm}
                            onChange={(e) => setInlineForm({ ...inlineForm, width_cm: e.target.value })}
                            className={`${cellInput} w-20`} />
                        ) : (
                          <span className="font-medium text-[#0f172a]">{p.width_cm} cm</span>
                        )}
                      </td>

                      {/* Alto */}
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <input type="number" value={inlineForm.height_cm}
                            onChange={(e) => setInlineForm({ ...inlineForm, height_cm: e.target.value })}
                            className={`${cellInput} w-20`} />
                        ) : (
                          <span className="font-medium text-[#0f172a]">{p.height_cm} cm</span>
                        )}
                      </td>

                      {/* Superficie */}
                      <td className="py-2 pr-3 font-semibold text-[#0f172a]">
                        {m2.toFixed(3)} m²
                      </td>

                      {/* Ubicación */}
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <select
                            value={inlineForm.location}
                            onChange={(e) => setInlineForm({ ...inlineForm, location: e.target.value as LocationType })}
                            className={cellInput}
                          >
                            <option value="SUPERFICIE">Superficie</option>
                            <option value="ALTURA">Altura</option>
                          </select>
                        ) : (
                          <span className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${p.location === "ALTURA" ? "bg-orange-100 text-orange-700" : "bg-sky-50 text-sky-700"}`}>
                            {p.location === "ALTURA" ? "Altura" : "Superficie"}
                          </span>
                        )}
                      </td>

                      {/* Obs */}
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <input type="text" value={inlineForm.notes}
                            onChange={(e) => setInlineForm({ ...inlineForm, notes: e.target.value })}
                            placeholder="—"
                            className={`${cellInput} w-28`} />
                        ) : (
                          <span className="text-[#94a3b8]">{p.notes || "—"}</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleInlineSave(idx)}
                                className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#d9622c] text-white hover:bg-[#b74e1e]"
                                title="Guardar"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => setInlineIdx(null)}
                                className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-[#dde4ee] text-[#64748b] hover:bg-[#f1f5f9]"
                                title="Cancelar"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleEdit(idx)} className="text-[#94a3b8] hover:text-[#d9622c]">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleDelete(idx)} className="text-[#94a3b8] hover:text-red-500">
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {glassPanes.length > PANES_PER_PAGE && (
              <div className="mt-3 flex items-center justify-between border-t border-[#f1f5f9] pt-3">
                <span className="text-[11px] text-[#94a3b8]">
                  {panePage * PANES_PER_PAGE + 1}–{Math.min((panePage + 1) * PANES_PER_PAGE, glassPanes.length)} de {glassPanes.length} vidrios
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={panePage === 0}
                    onClick={() => setPanePage((p) => p - 1)}
                    className="rounded-[6px] border border-[#dde4ee] px-2.5 py-1 text-[11px] font-medium text-[#475569] disabled:opacity-40 hover:bg-[#f1f5f9]"
                  >
                    ‹ Anterior
                  </button>
                  {Array.from({ length: Math.ceil(glassPanes.length / PANES_PER_PAGE) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPanePage(i)}
                      className={`h-6 w-6 rounded-[6px] text-[11px] font-semibold ${panePage === i ? "bg-[#d9622c] text-white" : "border border-[#dde4ee] text-[#475569] hover:bg-[#f1f5f9]"}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    disabled={panePage >= Math.ceil(glassPanes.length / PANES_PER_PAGE) - 1}
                    onClick={() => setPanePage((p) => p + 1)}
                    className="rounded-[6px] border border-[#dde4ee] px-2.5 py-1 text-[11px] font-medium text-[#475569] disabled:opacity-40 hover:bg-[#f1f5f9]"
                  >
                    Siguiente ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {glassPanes.length === 0 && (
          <p className="mt-4 text-center text-[13px] text-[#94a3b8]">Agregá al menos un vidrio para continuar.</p>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Lámina ────────────────────────────────────────────────────────────

function Step2({
  glassPanes,
  filmMode,
  setFilmMode,
  singleProductId,
  setSingleProductId,
  perGlassMap,
  setPerGlassMap,
}: {
  glassPanes: GlassEntry[];
  filmMode: FilmMode;
  setFilmMode: (m: FilmMode) => void;
  singleProductId: string;
  setSingleProductId: (id: string) => void;
  perGlassMap: Record<string, string>;
  setPerGlassMap: (m: Record<string, string>) => void;
}) {
  const { data: session } = useSession();
  const { data: products = [] } = useProducts();
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

  // For single mode summary
  const singleProduct = activeProducts.find((p) => p.id === singleProductId);

  // For per-glass mode: summary chips per material
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

  const allAssigned = glassPanes.every((p) => !!perGlassMap[p.pane_id]);

  return (
    <div className="space-y-5">
      {/* Mode selector */}
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
          <p className="mb-3 text-[12px] text-[#94a3b8]">
            Vidrios: {glassTypeNames}
          </p>
          <div className="space-y-2">
            {activeProducts.map((p) => {
              const brand = p.brand_id;
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
            {glassPanes.map((pane) => {
              const m2 = (pane.width_cm / 100) * (pane.height_cm / 100) * pane.quantity;
              const assigned = perGlassMap[pane.pane_id] ?? "";
              const assignedProduct = activeProducts.find((p) => p.id === assigned);
              return (
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
                    value={assigned}
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
              );
            })}
          </div>

          {/* Material summary chips */}
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

          {!allAssigned && (
            <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              <AlertTriangle size={13} />
              Asigná una lámina a cada vidrio para continuar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 3: Confirm ───────────────────────────────────────────────────────────

function Step3({
  glassPanes,
  lines,
  setLines,
  heightSurchargePct,
  setHeightSurchargePct,
  travelCost,
  setTravelCost,
  discountPct,
  setDiscountPct,
  taxPct,
  setTaxPct,
  gapCm,
  setGapCm,
  conditions,
  setConditions,
  cutPlan,
  customers,
  customerId,
}: {
  glassPanes: GlassEntry[];
  lines: QuoteLineLocal[];
  setLines: (l: QuoteLineLocal[]) => void;
  heightSurchargePct: number;
  setHeightSurchargePct: (v: number) => void;
  travelCost: number;
  setTravelCost: (v: number) => void;
  discountPct: number;
  setDiscountPct: (v: number) => void;
  taxPct: number;
  setTaxPct: (v: number) => void;
  gapCm: number;
  setGapCm: (v: number) => void;
  conditions: string;
  setConditions: (v: string) => void;
  cutPlan: CutPlan;
  customers: { id: string; name: string; phone?: string | null; address?: string | null }[];
  customerId: string;
}) {
  const hasAltura = glassPanes.some((p) => p.location === "ALTURA");
  const totals = calcTotals(lines, glassPanes, heightSurchargePct, travelCost, discountPct, taxPct);
  const totalM2 = glassPanes.reduce((s, p) => s + (p.width_cm / 100) * (p.height_cm / 100) * p.quantity, 0);
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const [cutPlanOpen, setCutPlanOpen] = useState(false);

  function updatePrice(productId: string, newPrice: number) {
    setLines(
      lines.map((l) =>
        l.product_id === productId
          ? { ...l, price_per_m2: newPrice, subtotal: Math.round(l.surface_m2 * newPrice * 100) / 100 }
          : l
      )
    );
  }

  const paneIds = glassPanes.map((p) => p.pane_id);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4 text-center">
          <p className="text-[24px] font-bold text-[#d9622c]">{glassPanes.reduce((s, p) => s + p.quantity, 0)}</p>
          <p className="text-[12px] text-[#94a3b8]">Vidrios</p>
        </div>
        <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4 text-center">
          <p className="text-[24px] font-bold text-blue-600">{totalM2.toFixed(1)}</p>
          <p className="text-[12px] text-[#94a3b8]">m²</p>
        </div>
        <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4 text-center">
          <p className="text-[14px] font-bold text-amber-600 leading-tight">
            {lines.length === 1
              ? (lines[0].product_snapshot as Record<string, string>).name ?? "—"
              : `${lines.length} Materiales`}
          </p>
          <p className="text-[12px] text-[#94a3b8]">Material</p>
        </div>
      </div>

      {/* Financial calculation */}
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
        <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]">
          <DollarSign size={15} className="text-emerald-500" />
          Cálculo Financiero
        </div>

        <div className="space-y-3">
          {lines.map((line) => {
            const snap = line.product_snapshot as Record<string, string | number>;
            const brandColor = String(snap.brand_color ?? "#d9622c");
            return (
              <div key={line.product_id} className="rounded-[10px] border border-[#f1f5f9] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: brandColor }}>
                      Material: {String(snap.name ?? "")}
                    </p>
                    <p className="text-[11px] text-[#94a3b8]">{line.surface_m2.toFixed(2)} m²</p>
                  </div>
                  <p className="text-[13px] font-bold text-[#0f172a]">{fmt(line.subtotal)}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#94a3b8]">$/m²</span>
                  <input
                    type="number"
                    value={line.price_per_m2}
                    onChange={(e) => updatePrice(line.product_id, parseFloat(e.target.value) || 0)}
                    className="w-32 rounded-[6px] border border-[#dde4ee] px-2 py-1 text-[12px] font-medium text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
                  />
                </div>
              </div>
            );
          })}

          {/* Recargo altura — stepper */}
          {hasAltura && (
            <div className="flex items-center justify-between rounded-[12px] border border-orange-100 bg-orange-50 px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-orange-700">↑ Trabajo en altura</p>
                <p className="text-[11px] text-orange-400">Recargo sobre vidrios en altura</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHeightSurchargePct(Math.max(0, heightSurchargePct - 5))}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-orange-100 text-[16px] font-bold text-orange-700 hover:bg-orange-200"
                >−</button>
                <div className="w-14 text-center">
                  <span className="text-[18px] font-bold text-orange-700">{heightSurchargePct}</span>
                  <span className="text-[12px] text-orange-500">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHeightSurchargePct(Math.min(100, heightSurchargePct + 5))}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-orange-100 text-[16px] font-bold text-orange-700 hover:bg-orange-200"
                >+</button>
                <span className="ml-3 min-w-[70px] text-right text-[13px] font-bold text-orange-600">{fmt(totals.heightSurcharge)}</span>
              </div>
            </div>
          )}

          {/* Viáticos — chips de presets */}
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

          {/* Subtotal */}
          <div className="flex items-center justify-between rounded-[10px] bg-[#f8fafc] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#475569]">Subtotal</p>
            <p className="text-[15px] font-bold text-[#0f172a]">{fmt(totals.subtotal)}</p>
          </div>

          {/* Descuento / Recargo — toggle + chips */}
          <div className="rounded-[12px] border border-[#e8ecf2] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#0f172a]">Ajuste de precio</span>
              {discountPct !== 0 && (
                <span className={`text-[13px] font-bold ${discountPct > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {discountPct > 0 ? `−${fmt(totals.discountAmount)}` : `+${fmt(Math.abs(totals.discountAmount))}`}
                </span>
              )}
            </div>
            {/* Segmented control */}
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
            {/* Preset chips */}
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
              <label className={`flex cursor-text items-center gap-1 rounded-[8px] border bg-white px-2.5 py-1.5 focus-within:border-emerald-400 ${![ 0, 5, 10, 15, 20].includes(Math.abs(discountPct)) ? "border-emerald-400 bg-emerald-50" : "border-[#dde4ee]"}`}>
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
                <span className="min-w-[70px] text-right text-[13px] font-bold text-violet-700">+{fmt(totals.taxAmount)}</span>
              )}
            </div>
          </div>

          {/* Margen */}
          {totals.margin != null && (
            <div className="flex items-center justify-between rounded-[8px] bg-emerald-50 px-3 py-2">
              <span className="text-[12px] font-medium text-emerald-700">
                Margen
                {totals.materialsSub > 0 && (
                  <span className="ml-1 text-[11px] text-emerald-600">
                    ({((totals.margin / totals.materialsSub) * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
              <span className="text-[13px] font-bold text-emerald-700">{fmt(totals.margin)}</span>
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
        </div>
      </div>

      {/* Cut plan */}
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
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700">
                  {cutPlan.materials.length} Materiales
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <label
                className="flex items-center gap-2 text-[11px] font-medium text-[#64748b]"
                onClick={(e) => e.stopPropagation()}
              >
                Espacio entre cortes (cm)
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={gapCm}
                  onChange={(e) => setGapCm(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-16 rounded-[8px] border border-[#dde4ee] bg-white px-2 py-1 text-[12px] font-medium text-[#0f172a] focus:border-purple-400 focus:outline-none text-center"
                />
              </label>
              <ChevronDown
                size={16}
                className={`text-[#94a3b8] transition-transform ${cutPlanOpen ? "rotate-180" : ""}`}
              />
            </span>
          </button>

          {cutPlanOpen && cutPlan.materials.map((mat, mi) => {
            const matPaneIds = lines.find((l) => l.product_id === mat.product_id)?.glass_pane_ids ?? [];
            return (
              <div key={mat.product_id} className={mi > 0 ? "mt-5 border-t border-[#f1f5f9] pt-5" : ""}>
                {cutPlan.materials.length > 1 && (
                  <p className="mb-3 text-[12px] font-semibold" style={{ color: mat.brand_color }}>
                    Lámina {mi + 1}: {mat.product_name}
                  </p>
                )}
                <div className="mb-3 grid grid-cols-4 gap-2">
                  <div className="rounded-[10px] bg-[#f0f4f8] p-3 text-center">
                    <p className="text-[16px] font-bold text-[#0f172a]">{mat.linear_m}m</p>
                    <p className="text-[10px] text-[#94a3b8]">Metros Lineales</p>
                  </div>
                  <div className="rounded-[10px] bg-emerald-50 p-3 text-center">
                    <p className="text-[16px] font-bold text-emerald-700">{mat.rolls}</p>
                    <p className="text-[10px] text-[#94a3b8]">Rollo{mat.rolls !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="rounded-[10px] bg-[#f0f4f8] p-3 text-center">
                    <p className="text-[16px] font-bold text-[#0f172a]">{mat.efficiency_pct}%</p>
                    <p className="text-[10px] text-[#94a3b8]">Eficiencia</p>
                  </div>
                  <div className="rounded-[10px] bg-amber-50 p-3 text-center">
                    <p className="text-[14px] font-bold text-amber-600">{mat.area_useful_m2}m²</p>
                    <p className="text-[10px] text-[#94a3b8]">Área Útil</p>
                  </div>
                </div>

                {mat.cuts.length > 0 && (
                  <CutDiagram rows={mat.cuts} rollWidthCm={mat.roll_width_cm} paneIds={matPaneIds} gapCm={gapCm} />
                )}
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
    </div>
  );
}

// ── Main wizard page ──────────────────────────────────────────────────────────

export default function NewQuotePage() {
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

  const [saleType, setSaleType] = useState<SaleType | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [glassPanes, setGlassPanes] = useState<GlassEntry[]>([]);
  const [customerId, setCustomerId] = useState("");

  // Step 2 state
  const [filmMode, setFilmMode] = useState<FilmMode>("SINGLE");
  const [singleProductId, setSingleProductId] = useState("");
  const [perGlassMap, setPerGlassMap] = useState<Record<string, string>>({});

  // Step 3 state
  const [heightSurchargePct, setHeightSurchargePct] = useState(30);
  const [travelCost, setTravelCost] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [gapCm, setGapCm] = useState(3);
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);

  useEffect(() => {
    if (userData?.default_commercial_conditions) {
      setConditions(userData.default_commercial_conditions);
    }
  }, [userData?.default_commercial_conditions]);

  // Derived lines for step 3
  const lines = useMemo<QuoteLineLocal[]>(() => {
    const activeProducts = products.filter((p) => p.is_active);
    if (filmMode === "SINGLE") {
      const product = activeProducts.find((p) => p.id === singleProductId);
      if (!product) return [];
      const totalM2 = glassPanes.reduce((s, p) => s + (p.width_cm / 100) * (p.height_cm / 100) * p.quantity, 0);
      const effective = priceByProduct[product.id];
      const price = Number(effective ? effective.effective_sale_price : product.sale_price_per_m2);
      const cost = Number(effective ? effective.effective_purchase_price : product.purchase_price_per_m2);
      return [
        {
          glass_pane_ids: glassPanes.map((p) => p.pane_id),
          product_id: product.id,
          product_snapshot: {
            name: product.name,
            brand_name: "",
            brand_color: "#d9622c",
            price_per_m2: price,
            uv_pct: product.uv_percentage,
            irr_pct: product.irr_percentage,
            purchase_price_per_m2: cost,
          },
          price_per_m2: price,
          surface_m2: Math.round(totalM2 * 10000) / 10000,
          subtotal: Math.round(totalM2 * price * 100) / 100,
        },
      ];
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
        return {
          glass_pane_ids: data.pane_ids,
          product_id: pid,
          product_snapshot: {
            name: product.name,
            brand_name: "",
            brand_color: "#d9622c",
            price_per_m2: price,
            uv_pct: product.uv_percentage,
            irr_pct: product.irr_percentage,
            purchase_price_per_m2: cost,
          },
          price_per_m2: price,
          surface_m2: m2,
          subtotal: Math.round(m2 * price * 100) / 100,
        };
      });
    }
  }, [filmMode, singleProductId, perGlassMap, glassPanes, products, priceByProduct]);

  const [editableLines, setEditableLines] = useState<QuoteLineLocal[]>([]);
  const activeLines = editableLines.length > 0 ? editableLines : lines;

  // Sync editable lines when lines change (step 2 → step 3)
  function goToStep3() {
    setEditableLines(lines);
    setStep(3);
  }

  const cutPlan = useMemo(
    () => computeCutPlan(glassPanes, activeLines, products, gapCm),
    [glassPanes, activeLines, products, gapCm]
  );

  // Validation
  const canProceedStep1 = glassPanes.length > 0;
  const canProceedStep2 =
    filmMode === "SINGLE"
      ? !!singleProductId
      : glassPanes.every((p) => !!perGlassMap[p.pane_id]);

  async function handleSave() {
    const today = new Date();
    const validUntil = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const selectedCustomer = customers.find((c) => c.id === customerId);
    const customerSnapshot = selectedCustomer
      ? { name: selectedCustomer.name, email: selectedCustomer.email ?? null, phone: selectedCustomer.phone, address: selectedCustomer.address }
      : null;

    try {
      const quote = await createQuote.mutateAsync({
        customer_id: customerId || null,
        customer_snapshot: customerSnapshot,
        sale_type: "ARCHITECTURE",
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
      });
      router.push(`/orders/${quote.id}` as never);
    } catch (_) {
      // error handled by query client
    }
  }

  if (saleType === null) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
        <header className="flex items-center gap-4 bg-white px-5 py-4 border-b border-[#e8ecf2]">
          <Link
            href="/orders"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#e8ecf2] text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-[17px] font-bold text-[#0f172a]">Nuevo Presupuesto</h1>
            <p className="text-[12px] text-[#94a3b8]">Crear cotización de instalación</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <SaleTypeSelector onSelect={setSaleType} />
        </div>
      </div>
    );
  }

  if (saleType === "AUTOMOTIVE") {
    return (
      <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
        <header className="flex items-center gap-4 bg-white px-5 py-4 border-b border-[#e8ecf2]">
          <Link
            href="/orders"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#e8ecf2] text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-[17px] font-bold text-[#0f172a]">Nuevo Presupuesto — Automotriz</h1>
            <p className="text-[12px] text-[#94a3b8]">Polarizado automotriz</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <AutomotiveQuoteForm onBack={() => setSaleType(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 bg-white px-4 py-4 border-b border-[#e8ecf2] sm:gap-4 sm:px-5">
        <Link
          href="/orders"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#e8ecf2] text-[#64748b] hover:bg-[#f1f5f9]"
        >
          <ArrowLeft size={15} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-bold text-[#0f172a]">Nuevo Presupuesto</h1>
          <p className="text-[12px] text-[#94a3b8]">Crear cotización de instalación</p>
        </div>
        <div className="ml-auto">
          <StepBar step={step} />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl">
          {step === 1 && (
            <Step1
              glassPanes={glassPanes}
              setGlassPanes={setGlassPanes}
              customerId={customerId}
              setCustomerId={setCustomerId}
            />
          )}
          {step === 2 && (
            <Step2
              glassPanes={glassPanes}
              filmMode={filmMode}
              setFilmMode={setFilmMode}
              singleProductId={singleProductId}
              setSingleProductId={setSingleProductId}
              perGlassMap={perGlassMap}
              setPerGlassMap={setPerGlassMap}
            />
          )}
          {step === 3 && (
            <Step3
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
              gapCm={gapCm}
              setGapCm={setGapCm}
              conditions={conditions}
              setConditions={setConditions}
              cutPlan={cutPlan}
              customers={customers}
              customerId={customerId}
            />
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="sticky bottom-0 flex items-center justify-between border-t border-[#e8ecf2] bg-white px-5 py-4">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          disabled={step === 1}
          className="flex items-center gap-2 rounded-[10px] border border-[#dde4ee] px-4 py-2 text-[13px] font-medium text-[#475569] disabled:opacity-30 hover:bg-[#f1f5f9]"
        >
          <ArrowLeft size={14} />
          Volver
        </button>

        {step < 3 ? (
          <button
            onClick={() => {
              if (step === 1 && canProceedStep1) setStep(2);
              else if (step === 2 && canProceedStep2) goToStep3();
            }}
            disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
            className="flex items-center gap-2 rounded-[10px] bg-[#d9622c] px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40 hover:bg-[#b74e1e]"
          >
            Siguiente: {step === 1 ? "Lámina" : "Confirmar"}
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={createQuote.isPending || activeLines.length === 0}
            className="flex items-center gap-2 rounded-[10px] bg-[#d9622c] px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40 hover:bg-[#b74e1e]"
          >
            {createQuote.isPending ? "Guardando..." : "Guardar Presupuesto"}
            <Check size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
