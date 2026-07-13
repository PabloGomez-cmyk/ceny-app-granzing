"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Layers,
  DollarSign,
  Scissors,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  SendHorizonal,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Mail,
} from "lucide-react";
import { useQuote, useUpdateQuoteStatus } from "@/hooks/useQuotes";
import { useUser } from "@/hooks/useUsers";
import { useGenerateWarranties, useWarrantiesByQuote } from "@/hooks/useWarranties";
import { useSession } from "next-auth/react";
import type { QuoteStatus } from "@/lib/api/quotes";
import dynamic from "next/dynamic";
import SendQuoteEmailModal from "@/components/email/SendQuoteEmailModal";
import SendWarrantiesEmailModal from "@/components/warranties/SendWarrantiesEmailModal";
import { CutDiagram, type CutRow } from "@/components/quotes/CutDiagram";

const DownloadPDFButton = dynamic(() => import("@/components/pdf/DownloadPDFButton"), { ssr: false });

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; dot: string }> = {
  DRAFT: { label: "En cotización", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  SENT: { label: "Enviado", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  ACCEPTED: { label: "Aceptado", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  INVOICED: { label: "Facturado", color: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  COMPLETED: { label: "Terminado", color: "bg-teal-50 text-teal-700", dot: "bg-teal-500" },
  CANCELLED: { label: "Cancelado", color: "bg-red-50 text-red-600", dot: "bg-red-400" },
};

const NEXT_STATUS: Partial<Record<QuoteStatus, QuoteStatus>> = {
  DRAFT: "SENT",
  SENT: "ACCEPTED",
  ACCEPTED: "INVOICED",
  INVOICED: "COMPLETED",
};

const NEXT_LABEL: Partial<Record<QuoteStatus, string>> = {
  DRAFT: "Marcar como Enviado",
  SENT: "Marcar como Aceptado",
  ACCEPTED: "Marcar como Facturado",
  INVOICED: "Marcar como Terminado",
};

function fmt(n: number | string) {
  return "$ " + Math.round(Number(n)).toLocaleString("es-AR");
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
      <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.userId;
  const { data: quote, isPending } = useQuote(id);
  const { data: companyUser = null } = useUser(userId ?? "");
  const updateStatus = useUpdateQuoteStatus();
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [warrantyEmailModalOpen, setWarrantyEmailModalOpen] = useState(false);
  const { data: warranties = [] } = useWarrantiesByQuote(id);
  const generateWarranties = useGenerateWarranties();

  if (isPending) {
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
        <Link href="/orders" className="text-[13px] text-[#d9622c] hover:underline">
          Volver a órdenes
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[quote.status as QuoteStatus];
  const nextStatus = NEXT_STATUS[quote.status as QuoteStatus];
  const nextLabel = NEXT_LABEL[quote.status as QuoteStatus];

  const totalM2 = quote.glass_panes.reduce((s, p) => s + Number(p.surface_m2), 0);
  const cutPlan = quote.cut_plan_snapshot as {
    materials?: {
      product_name: string;
      linear_m: number;
      rolls: number;
      efficiency_pct: number;
      area_useful_m2: number;
      roll_width_cm: number;
      cuts: CutRow[];
    }[];
    total_linear_m?: number;
    total_rolls?: number;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* Header */}
      <header className="flex items-center justify-between bg-white px-5 py-4 border-b border-[#e8ecf2]">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#e8ecf2] text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-[17px] font-bold text-[#0f172a]">{quote.quote_number}</h1>
            <p className="text-[12px] text-[#94a3b8]">Detalle del presupuesto</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${statusCfg.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
          <DownloadPDFButton quote={quote} company={companyUser} />
          <button
            onClick={() => setEmailModalOpen(true)}
            className="flex items-center gap-1.5 rounded-[10px] border border-[#dde4ee] px-3 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9]"
          >
            <Mail size={13} />
            <span className="hidden sm:inline">Enviar por email</span>
          </button>
          {quote.status === "COMPLETED" && warranties.length === 0 && (
            <button
              onClick={() => generateWarranties.mutate(quote.id)}
              disabled={generateWarranties.isPending}
              className="flex items-center gap-1.5 rounded-[10px] border border-[#dde4ee] px-3 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50"
            >
              <ShieldCheck size={13} />
              <span className="hidden sm:inline">
                {generateWarranties.isPending ? "Generando..." : "Generar garantías"}
              </span>
            </button>
          )}
          {quote.status === "COMPLETED" && warranties.length > 0 && (
            <button
              onClick={() => setWarrantyEmailModalOpen(true)}
              className="flex items-center gap-1.5 rounded-[10px] border border-[#dde4ee] px-3 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9]"
            >
              <ShieldCheck size={13} />
              <span className="hidden sm:inline">Enviar garantía</span>
            </button>
          )}
          {quote.status !== "INVOICED" && quote.status !== "COMPLETED" && quote.status !== "CANCELLED" && (
            <button
              onClick={() => router.push(`/orders/${quote.id}/edit` as never)}
              className="rounded-[10px] border border-[#dde4ee] px-4 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9]"
            >
              Editar
            </button>
          )}
          {nextStatus && (
            <button
              onClick={() => updateStatus.mutate({ id: quote.id, status: nextStatus })}
              disabled={updateStatus.isPending}
              className="rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50 hover:bg-[#b74e1e]"
            >
              {nextLabel}
            </button>
          )}
          {quote.status !== "CANCELLED" && quote.status !== "INVOICED" && quote.status !== "COMPLETED" && (
            <button
              onClick={() => updateStatus.mutate({ id: quote.id, status: "CANCELLED" })}
              disabled={updateStatus.isPending}
              className="rounded-[10px] border border-red-200 px-3 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 p-5">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_320px]">
          {/* Left column */}
          <div className="space-y-5">
            {/* Client info */}
            <Section title="Información del Cliente" icon={<FileText size={15} className="text-blue-500" />}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-medium text-[#94a3b8]">Cliente</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[#0f172a]">
                    {quote.customer_snapshot ? (quote.customer_snapshot as Record<string, string>).name : "Sin cliente"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#94a3b8]">Dirección</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[13px] text-[#475569]">
                    <MapPin size={11} />
                    {quote.customer_snapshot
                      ? (quote.customer_snapshot as Record<string, string>).address ?? "—"
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#94a3b8]">Fecha de creación</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[13px] text-[#475569]">
                    <Calendar size={11} />
                    {new Date(quote.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#94a3b8]">Estado</p>
                  <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>
              </div>
            </Section>

            {/* Glass panes */}
            <Section title="Vidrios del Proyecto" icon={<Layers size={15} className="text-[#d9622c]" />}>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700">
                  {totalM2.toFixed(2)} m²
                </span>
                {quote.has_altura && (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-[12px] font-semibold text-orange-700">
                    Trabajo en altura
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#f1f5f9]">
                      {["ID", "Tipo", "Dimensiones (cm)", "Superficie", "Ubicación"].map((h) => (
                        <th key={h} className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quote.glass_panes.map((p) => (
                      <tr key={p.pane_id} className="border-b border-[#f8fafc]">
                        <td className="py-2.5 pr-4 font-bold text-[#0f172a]">{p.pane_id}</td>
                        <td className="py-2.5 pr-4">
                          <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[11px] font-medium text-[#475569]">
                            {p.glass_type_name}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-[#475569]">
                          {p.width_cm} × {p.height_cm} cm
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-[#0f172a]">{Number(p.surface_m2).toFixed(3)} m²</td>
                        <td className="py-2.5">
                          <span className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${p.location === "ALTURA" ? "bg-orange-100 text-orange-700" : "bg-sky-50 text-sky-700"}`}>
                            {p.location === "ALTURA" ? "Altura" : "Superficie"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Cut plan summary */}
            {cutPlan.materials && cutPlan.materials.length > 0 && (
              <Section title="Plan de Cortes" icon={<Scissors size={15} className="text-purple-600" />}>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="rounded-[10px] bg-[#f0f4f8] p-3 text-center">
                    <p className="text-[16px] font-bold text-[#0f172a]">{cutPlan.total_linear_m}m</p>
                    <p className="text-[10px] text-[#94a3b8]">Metros lineales</p>
                  </div>
                  <div className="rounded-[10px] bg-emerald-50 p-3 text-center">
                    <p className="text-[16px] font-bold text-emerald-700">{cutPlan.total_rolls}</p>
                    <p className="text-[10px] text-[#94a3b8]">Rollos</p>
                  </div>
                  <div className="rounded-[10px] bg-amber-50 col-span-2 p-3 text-center">
                    <p className="text-[13px] font-bold text-amber-600">
                      {cutPlan.materials.length === 1
                        ? cutPlan.materials[0].product_name
                        : `${cutPlan.materials.length} Materiales`}
                    </p>
                    <p className="text-[10px] text-[#94a3b8]">Estrategia</p>
                  </div>
                </div>
                {cutPlan.materials.map((mat, mi) => {
                  const paneIds = mat.cuts.flatMap((row) => row.pieces.map((p) => p.pane_id));
                  return (
                    <div key={mi} className={mi > 0 ? "mt-5 border-t border-[#f1f5f9] pt-5" : ""}>
                      {cutPlan.materials!.length > 1 && (
                        <p className="mb-3 text-[12px] font-semibold text-[#0f172a]">
                          Corte {mi + 1}: {mat.product_name}
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
                        <CutDiagram rows={mat.cuts} rollWidthCm={mat.roll_width_cm} paneIds={paneIds} gapCm={quote.gap_cm} />
                      )}
                    </div>
                  );
                })}
              </Section>
            )}

            {/* Commercial conditions */}
            {quote.commercial_conditions && (
              <Section title="Condiciones Comerciales" icon={<FileText size={15} className="text-[#94a3b8]" />}>
                <pre className="whitespace-pre-wrap text-[12px] text-[#475569] font-sans">{quote.commercial_conditions}</pre>
              </Section>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Lámina seleccionada */}
            <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
              <p className="mb-3 text-[13px] font-semibold text-[#0f172a]">
                {quote.lines.length === 1 ? "Lámina Seleccionada" : "Materiales"}
              </p>
              <div className="space-y-2">
                {quote.lines.map((line) => {
                  const snap = line.product_snapshot as Record<string, string | number>;
                  return (
                    <div
                      key={line.line_id}
                      className="rounded-[10px] border border-[#e8ecf2] px-4 py-3"
                      style={{ borderLeftColor: String(snap.brand_color ?? "#d9622c"), borderLeftWidth: 3 }}
                    >
                      <p className="text-[13px] font-semibold text-[#0f172a]">{String(snap.name ?? "")}</p>
                      <p className="text-[11px] text-[#94a3b8]">
                        {Number(line.surface_m2).toFixed(2)} m² · ${Number(line.price_per_m2).toLocaleString("es-AR")}/m²
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial summary */}
            <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
              <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-[#0f172a]">
                <DollarSign size={14} className="text-emerald-500" />
                Resumen Financiero
              </div>
              <div className="space-y-2.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#475569]">Material + Instalación</span>
                  <span className="font-semibold text-[#0f172a]">{fmt(quote.totals.materials_subtotal)}</span>
                </div>
                {quote.has_altura && Number(quote.totals.height_surcharge) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-orange-600">↑ Recargo altura ({quote.height_surcharge_pct}%)</span>
                    <span className="font-semibold text-orange-600">{fmt(quote.totals.height_surcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-blue-600">Viáticos</span>
                  <span className="font-semibold text-[#0f172a]">{fmt(quote.totals.travel_cost)}</span>
                </div>
                <div className="flex justify-between border-t border-[#f1f5f9] pt-2.5">
                  <span className="font-semibold text-[#0f172a]">Subtotal</span>
                  <span className="font-bold text-[#0f172a]">{fmt(quote.totals.subtotal)}</span>
                </div>
                {quote.discount_pct !== 0 && (
                  <div className="flex justify-between">
                    <span className={quote.discount_pct > 0 ? "text-emerald-600" : "text-orange-600"}>
                      {quote.discount_pct > 0 ? "Descuento" : "Recargo"} ({Math.abs(quote.discount_pct)}%)
                    </span>
                    <span className={`font-semibold ${quote.discount_pct > 0 ? "text-emerald-600" : "text-orange-600"}`}>
                      {quote.discount_pct > 0 ? "-" : "+"}{fmt(Math.abs(Number(quote.totals.discount_amount)))}
                    </span>
                  </div>
                )}
                {Number(quote.tax_pct) > 0 && (
                  <div className="flex justify-between rounded-[8px] bg-violet-50 px-2 py-1.5">
                    <span className="text-violet-700 font-medium">IVA {Number(quote.tax_pct)}%</span>
                    <span className="font-semibold text-violet-700">+{fmt(quote.totals.tax_amount)}</span>
                  </div>
                )}
                {quote.total_margin != null && (
                  <div className="flex justify-between rounded-[8px] bg-emerald-50 px-2 py-1.5">
                    <span className="text-emerald-700 font-medium">
                      Margen
                      {Number(quote.totals.materials_subtotal) > 0 && (
                        <span className="ml-1 text-[11px] text-emerald-600">
                          ({((Number(quote.total_margin) / Number(quote.totals.materials_subtotal)) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-emerald-700">{fmt(quote.total_margin)}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-[12px] bg-[#d9622c] px-4 py-3">
                <div>
                  <span className="text-[13px] font-bold text-white">TOTAL</span>
                  {Number(quote.tax_pct) > 0 && <p className="text-[10px] text-white/70">IVA {Number(quote.tax_pct)}% incluido</p>}
                </div>
                <span className="text-[18px] font-bold text-white">{fmt(quote.totals.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {emailModalOpen && (
        <SendQuoteEmailModal
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          quote={quote}
          company={companyUser}
          customerEmail={
            quote.customer_snapshot
              ? (quote.customer_snapshot as Record<string, string>).email ?? ""
              : ""
          }
          customerName={
            quote.customer_snapshot
              ? (quote.customer_snapshot as Record<string, string>).name ?? ""
              : ""
          }
          onClose={() => setEmailModalOpen(false)}
        />
      )}

      {warrantyEmailModalOpen && warranties.length > 0 && (
        <SendWarrantiesEmailModal
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          warranties={warranties}
          customerEmail={
            quote.customer_snapshot
              ? (quote.customer_snapshot as Record<string, string>).email ?? ""
              : ""
          }
          customerName={
            quote.customer_snapshot
              ? (quote.customer_snapshot as Record<string, string>).name ?? ""
              : ""
          }
          onClose={() => setWarrantyEmailModalOpen(false)}
        />
      )}
    </div>
  );
}
