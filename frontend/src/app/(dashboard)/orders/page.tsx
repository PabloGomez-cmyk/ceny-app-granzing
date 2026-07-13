"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  SendHorizonal,
  Receipt,
  ShieldCheck,
  Trash2,
  X,
  Mail,
} from "lucide-react";
import UserMenu from "@/components/layout/UserMenu";
import ProfileModal from "@/components/profile/ProfileModal";
import { useQuotes, useDeleteQuote } from "@/hooks/useQuotes";
import { useUser } from "@/hooks/useUsers";
import type { Quote, QuoteStatus } from "@/lib/api/quotes";
import dynamic from "next/dynamic";
import SendQuoteEmailModal from "@/components/email/SendQuoteEmailModal";

const DownloadPDFButton = dynamic(() => import("@/components/pdf/DownloadPDFButton"), { ssr: false });

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: { label: "Borrador", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400", icon: FileText },
  SENT: { label: "Enviado", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500", icon: SendHorizonal },
  ACCEPTED: { label: "Aceptado", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  INVOICED: { label: "Facturado", color: "bg-violet-50 text-violet-700", dot: "bg-violet-500", icon: Receipt },
  COMPLETED: { label: "Terminado", color: "bg-teal-50 text-teal-700", dot: "bg-teal-500", icon: ShieldCheck },
  CANCELLED: { label: "Cancelado", color: "bg-red-50 text-red-600", dot: "bg-red-400", icon: XCircle },
} as const;

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, sub, accent }: { value: string | number; label: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-[12px] border bg-white p-4 ${accent ? "border-l-4 border-l-amber-400 border-[#e8ecf2]" : "border-[#e8ecf2]"}`}>
      <p className={`font-bold text-[28px] leading-none ${accent ? "text-amber-500" : "text-[#0f172a]"}`}>{value}</p>
      <p className="mt-1 text-[13px] font-semibold text-[#374151]">{label}</p>
      <p className="text-[11px] text-[#94a3b8]">{sub}</p>
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  selected,
  onToggle,
}: {
  order: Quote;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[order.status as QuoteStatus];
  const customerName = order.customer_snapshot
    ? (order.customer_snapshot as Record<string, string>).name ?? "Sin cliente"
    : "Sin cliente";
  const createdAt = new Date(order.created_at).toLocaleDateString("es-AR");

  return (
    <tr
      className={`border-b border-[#f1f5f9] transition-colors ${selected ? "bg-red-50" : "hover:bg-[#f8fafb]"}`}
    >
      {/* Checkbox */}
      <td className="py-3 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(order.id)}
          className="h-4 w-4 cursor-pointer accent-[#d9622c]"
        />
      </td>
      <td
        className="cursor-pointer py-3 pl-1 pr-3"
        onClick={() => (window.location.href = `/orders/${order.id}`)}
      >
        <p className="text-[13px] font-bold text-[#0f172a]">{order.quote_number}</p>
        <p className="text-[11px] text-[#94a3b8]">{createdAt}</p>
      </td>
      <td className="cursor-pointer px-3 py-3 text-[13px] text-[#374151]" onClick={() => (window.location.href = `/orders/${order.id}`)}>{customerName}</td>
      <td className="cursor-pointer px-3 py-3" onClick={() => (window.location.href = `/orders/${order.id}`)}>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </td>
      <td className="cursor-pointer px-3 py-3 text-[12px] text-[#64748b]" onClick={() => (window.location.href = `/orders/${order.id}`)}>
        {order.lines.length} ítem{order.lines.length !== 1 ? "s" : ""}
      </td>
      <td className="cursor-pointer px-3 py-3 text-right text-[13px] font-bold text-[#0f172a]" onClick={() => (window.location.href = `/orders/${order.id}`)}>
        ${Math.round(Number(order.totals.total)).toLocaleString("es-AR")}
      </td>
      <td className="cursor-pointer py-3 pl-3 pr-5 text-[12px] text-[#94a3b8]" onClick={() => (window.location.href = `/orders/${order.id}`)}>
        {order.valid_until ? `Vence ${order.valid_until}` : "—"}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const role = session?.role;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const userId = session?.userId;

  const { data: orders = [], isLoading: loadingOrders } = useQuotes();
  const deleteQuote = useDeleteQuote();
  const { data: companyUser = null } = useUser(userId ?? "");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | "ALL">("ALL");
  const [profileOpen, setProfileOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  if (status === "loading") return null;

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === "ALL" || o.status === filterStatus;
    const q = search.toLowerCase();
    const customerName = o.customer_snapshot
      ? (o.customer_snapshot as Record<string, string>).name ?? ""
      : "";
    const matchSearch = !q || o.quote_number.toLowerCase().includes(q) || customerName.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const acceptedTotal = orders
    .filter((o) => ["ACCEPTED", "INVOICED", "COMPLETED"].includes(o.status))
    .reduce((acc, o) => acc + Number(o.totals.total), 0);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((o) => o.id)));
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirmDelete(false);
  }

  async function handleBulkDelete() {
    setDeleting(true);
    try {
      await Promise.all([...selected].map((id) => deleteQuote.mutateAsync(id)));
      setSelected(new Set());
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const allFilteredSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between bg-[#d9622c] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-bold text-[17px] text-white">Órdenes de venta</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={"/orders/warranties" as never}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
            title="Garantías emitidas"
          >
            <ShieldCheck size={16} />
          </Link>
          <UserMenu name={name} email={email} role={role} onOpenProfile={() => setProfileOpen(true)} variant="dark" />
        </div>
      </header>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4eaf2] bg-white px-5 py-3">
        <Link
          href={"/orders/new" as never}
          data-tour="orders-new"
          className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e]"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Nuevo presupuesto</span>
          <span className="sm:hidden">Nuevo</span>
        </Link>

        <div className="relative flex-1 sm:max-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar orden o cliente..."
            className="h-[36px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] pl-8 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
          />
        </div>

        {/* Status filter */}
        <div className="flex overflow-x-auto overflow-y-hidden rounded-[10px] border border-[#dde4ee] bg-[#f8fafc]">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`whitespace-nowrap px-3 py-1.5 text-[12px] font-medium transition-colors ${filterStatus === "ALL" ? "bg-[#d9622c] text-white" : "text-[#475569] hover:bg-[#f1f5f9]"}`}
          >
            Todos
          </button>
          {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`whitespace-nowrap px-3 py-1.5 text-[12px] font-medium transition-colors ${filterStatus === s ? "bg-[#d9622c] text-white" : "text-[#475569] hover:bg-[#f1f5f9]"}`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[12px] text-[#94a3b8]">
          {filtered.length} orden{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* ── Barra de selección ──────────────────────────────────────────────── */}
      {someSelected && (
        <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-2.5">
          <span className="text-[13px] font-semibold text-red-700">
            {selected.size} presupuesto{selected.size !== 1 ? "s" : ""} seleccionado{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {/* Acciones para 1 seleccionado */}
            {selected.size === 1 && (() => {
              const selId = [...selected][0];
              const selQuote = orders.find((o) => o.id === selId);
              return selQuote ? (
                <>
                  <DownloadPDFButton
                    quote={selQuote}
                    company={companyUser}
                    label="Descargar PDF"
                    className="flex items-center gap-1.5 rounded-[8px] border border-[#dde4ee] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9]"
                  />
                  <button
                    onClick={() => setEmailModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-[8px] border border-[#dde4ee] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9]"
                  >
                    <Mail size={13} />
                    Enviar por email
                  </button>
                </>
              ) : null;
            })()}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-[8px] bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700"
              >
                <Trash2 size={13} />
                Eliminar seleccionados
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-red-700">¿Confirmar eliminación?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="rounded-[8px] bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-[8px] border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-100"
                >
                  Cancelar
                </button>
              </div>
            )}
            <button onClick={clearSelection} className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-5">
        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={orders.filter((o) => o.status === "DRAFT").length} label="Borradores" sub="presupuestos sin enviar" />
          <StatCard value={orders.filter((o) => o.status === "SENT").length} label="Enviados" sub="esperando respuesta" />
          <StatCard value={orders.filter((o) => o.status === "ACCEPTED").length} label="Aceptados" sub="listos para facturar" />
          <StatCard value={`$${Math.round(acceptedTotal).toLocaleString("es-AR")}`} label="Total facturado" sub="aceptados + facturados" accent />
        </div>

        {loadingOrders && (
          <p className="py-8 text-center text-[13px] text-[#94a3b8]">Cargando presupuestos...</p>
        )}

        {/* ── Table desktop ───────────────────────────────────────────────── */}
        {!loadingOrders && (
          <div className="hidden overflow-hidden rounded-[12px] border border-[#e8ecf2] bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                  {/* Checkbox "seleccionar todos" */}
                  <th className="w-10 py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer accent-[#d9622c]"
                      title={allFilteredSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                    />
                  </th>
                  {["#", "Cliente", "Estado", "Ítems", "Total", "Vencimiento"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[13px] text-[#94a3b8]">
                      {orders.length === 0 ? "Todavía no hay presupuestos. ¡Creá el primero!" : "Sin resultados para el filtro aplicado."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      selected={selected.has(order.id)}
                      onToggle={toggleOne}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Cards mobile ────────────────────────────────────────────────── */}
        {!loadingOrders && (
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((order) => {
              const cfg = STATUS_CONFIG[order.status as QuoteStatus];
              const customerName = order.customer_snapshot
                ? (order.customer_snapshot as Record<string, string>).name ?? "Sin cliente"
                : "Sin cliente";
              const isSelected = selected.has(order.id);
              return (
                <div
                  key={order.id}
                  className={`rounded-[12px] border bg-white p-4 ${isSelected ? "border-red-300 bg-red-50" : "border-[#e8ecf2]"}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(order.id)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-[#d9622c]"
                    />
                    <Link href={`/orders/${order.id}` as never} className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[13px] font-bold text-[#0f172a]">{order.quote_number}</p>
                          <p className="text-[12px] text-[#64748b]">{customerName}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-[#f1f5f9] pt-3">
                        <span className="text-[11px] text-[#94a3b8]">
                          {order.lines.length} ítem{order.lines.length !== 1 ? "s" : ""}
                          {order.valid_until ? ` · vence ${order.valid_until}` : ""}
                        </span>
                        <span className="text-[13px] font-bold text-[#0f172a]">
                          ${Math.round(Number(order.totals.total)).toLocaleString("es-AR")}
                        </span>
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {profileOpen && userId && (
        <ProfileModal userId={userId} userName={name} userEmail={email} onClose={() => setProfileOpen(false)} />
      )}

      {emailModalOpen && selected.size === 1 && (() => {
        const selId = [...selected][0];
        const selQuote = orders.find((o) => o.id === selId);
        if (!selQuote) return null;
        const snap = selQuote.customer_snapshot as Record<string, string> | null;
        return (
          <SendQuoteEmailModal
            quoteId={selQuote.id}
            quoteNumber={selQuote.quote_number}
            quote={selQuote}
            company={companyUser}
            customerEmail={snap?.email ?? ""}
            customerName={snap?.name ?? ""}
            onClose={() => setEmailModalOpen(false)}
          />
        );
      })()}
    </div>
  );
}
