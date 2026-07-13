"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  Settings,
  ChevronDown,
  Tag,
  Pencil,
  UserX,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";
import {
  useCustomers,
  useCustomerLabels,
  useDeactivateCustomer,
  useUpdateCustomer,
} from "@/hooks/useCustomers";
import { useQuotes } from "@/hooks/useQuotes";
import CustomerFormModal, {
  type CustomerModalMode,
} from "@/components/customers/CustomerFormModal";
import UserMenu from "@/components/layout/UserMenu";
import ProfileModal from "@/components/profile/ProfileModal";
import type { Customer, CustomerLabel } from "@/lib/api/customers";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const bg = avatarColor(name);
  const fontSize = size <= 32 ? 11 : 13;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize }}
    >
      {getInitials(name)}
    </div>
  );
}

function LabelBadge({ label }: { label: CustomerLabel }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: label.color }}
    >
      {label.name}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
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
        accent
          ? "border-l-4 border-l-amber-400 border-[#e8ecf2]"
          : "border-[#e8ecf2]"
      }`}
    >
      <p
        className={`font-bold text-[28px] leading-none ${
          accent ? "text-amber-500" : "text-[#0f172a]"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#374151]">{label}</p>
      <p className="text-[11px] text-[#94a3b8]">{sub}</p>
    </div>
  );
}

// ── Customer row (desktop) ────────────────────────────────────────────────────

function CustomerRow({
  customer,
  label,
  selected,
  onSelect,
  onEdit,
}: {
  customer: Customer;
  label: CustomerLabel | undefined;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafb] ${
        selected ? "bg-[#fbeee1]" : ""
      }`}
    >
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size={36} />
          <p className="text-[13px] font-semibold text-[#0f172a]">{customer.name}</p>
        </div>
      </td>
      <td className="px-3 py-3">
        {label ? <LabelBadge label={label} /> : <span className="text-[12px] text-[#cbd5e1]">—</span>}
      </td>
      <td className="px-3 py-3 text-[13px] text-[#475569]">
        {customer.email ?? <span className="text-[#cbd5e1]">—</span>}
      </td>
      <td className="px-3 py-3 text-[13px] text-[#475569]">
        {customer.phone ?? <span className="text-[#cbd5e1]">—</span>}
      </td>
      <td className="px-3 py-3">
        <StatusBadge active={customer.is_active} />
      </td>
      <td
        className="py-3 pl-3 pr-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="rounded-[8px] border border-[#e2e6f0] px-3 py-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:bg-[#f1f5f9]"
        >
          Editar
        </button>
      </td>
    </tr>
  );
}

// ── Customer card (mobile) ────────────────────────────────────────────────────

function CustomerCard({
  customer,
  label,
  onEdit,
}: {
  customer: Customer;
  label: CustomerLabel | undefined;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size={40} />
          <div>
            <p className="text-[13px] font-semibold text-[#0f172a]">{customer.name}</p>
            {label && <LabelBadge label={label} />}
          </div>
        </div>
        <StatusBadge active={customer.is_active} />
      </div>

      {(customer.email || customer.phone) && (
        <div className="mt-3 flex flex-col gap-1 border-t border-[#f1f5f9] pt-3">
          {customer.email && (
            <div className="flex items-center gap-2 text-[12px] text-[#64748b]">
              <Mail size={12} className="shrink-0 text-[#94a3b8]" />
              {customer.email}
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-[12px] text-[#64748b]">
              <Phone size={12} className="shrink-0 text-[#94a3b8]" />
              {customer.phone}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end border-t border-[#f1f5f9] pt-3">
        <button
          onClick={onEdit}
          className="rounded-[8px] border border-[#e2e6f0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f1f5f9]"
        >
          Editar
        </button>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function CustomerDetailPanel({
  customer,
  label,
  onEdit,
  onToggleActive,
  isToggling,
}: {
  customer: Customer;
  label: CustomerLabel | undefined;
  onEdit: () => void;
  onToggleActive: () => void;
  isToggling: boolean;
}) {
  return (
    <div className="border-t border-[#e8ecf2] bg-white px-6 py-4">
      <p className="mb-3 text-[12px] font-semibold text-[#94a3b8]">
        Detalle de cliente — {customer.name}
      </p>
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size={44} />
          <div>
            <p className="text-[14px] font-bold text-[#0f172a]">{customer.name}</p>
            {label && <LabelBadge label={label} />}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {customer.email && (
            <div className="flex items-center gap-2 text-[13px] text-[#475569]">
              <Mail size={13} className="text-[#94a3b8]" />
              {customer.email}
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-[13px] text-[#475569]">
              <Phone size={13} className="text-[#94a3b8]" />
              {customer.phone}
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-[13px] text-[#475569]">
              <MapPin size={13} className="text-[#94a3b8]" />
              {customer.address}
            </div>
          )}
          {customer.notes && (
            <div className="flex items-start gap-2 text-[13px] text-[#475569]">
              <FileText size={13} className="mt-0.5 text-[#94a3b8]" />
              <span className="max-w-[300px] line-clamp-2">{customer.notes}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e]"
        >
          <Pencil size={13} />
          Editar cliente
        </button>
        <button
          onClick={onToggleActive}
          disabled={isToggling}
          className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[12px] font-medium disabled:opacity-60 ${
            customer.is_active
              ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {customer.is_active ? (
            <><UserX size={13} /> Desactivar</>
          ) : (
            <><UserCheck size={13} /> Reactivar</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FilterTab = "active" | "all";

export default function CustomersPage() {
  const { data: session, status } = useSession();
  const role = session?.role;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const userId = session?.userId;

  const { data: customers = [], isLoading, error } = useCustomers();
  const { data: labels = [] } = useCustomerLabels();
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateCustomer();
  const { mutate: updateCustomer, isPending: isReactivating } = useUpdateCustomer();
  const { data: quotes = [] } = useQuotes();

  const [filter, setFilter] = useState<FilterTab>("active");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: CustomerModalMode; customer?: Customer } | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setConfigOpen(false);
      }
    }
    if (configOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [configOpen]);

  const labelsMap = useMemo(() => {
    const m = new Map<string, CustomerLabel>();
    for (const l of labels) m.set(l.id, l);
    return m;
  }, [labels]);

  const activeLabels = labels.filter((l) => l.is_active);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const matchFilter = filter === "all" || c.is_active;
      const matchLabel = labelFilter === "all" || c.label_id === labelFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q);
      return matchFilter && matchLabel && matchSearch;
    });
  }, [customers, filter, labelFilter, search]);

  if (status === "loading") return null;

  const selectedCustomer = customers.find((c) => c.id === selectedId) ?? null;
  const activeCount = customers.filter((c) => c.is_active).length;

  const totalQuotes = quotes.length;
  const nonCancelled = quotes.filter((q) => q.status !== "CANCELLED");
  const converted = nonCancelled.filter(
    (q) => q.status === "ACCEPTED" || q.status === "INVOICED"
  );
  const conversionRate =
    nonCancelled.length > 0
      ? Math.round((converted.length / nonCancelled.length) * 1000) / 10
      : 0;

  function handleToggleActive(customer: Customer) {
    if (customer.is_active) {
      deactivate(customer.id);
    } else {
      updateCustomer({ id: customer.id, data: { is_active: true } });
    }
    setSelectedId(null);
  }

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
          <h1 className="font-bold text-[17px] text-white">Clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Dropdown Configuración */}
          <div ref={configRef} className="relative">
            <button
              onClick={() => setConfigOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-[8px] bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/25"
            >
              <Settings size={14} />
              Configuración
              <ChevronDown
                size={13}
                className={`transition-transform ${configOpen ? "rotate-180" : ""}`}
              />
            </button>
            {configOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 overflow-hidden rounded-[10px] border border-[#e8ecf2] bg-white shadow-lg">
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Clientes
                </p>
                <Link
                  href="/customers/settings/labels"
                  onClick={() => setConfigOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[#374151] transition-colors hover:bg-[#fbeee1] hover:text-[#d9622c]"
                >
                  <Tag size={14} className="text-[#d9622c]" />
                  Etiquetas de contacto
                </Link>
              </div>
            )}
          </div>
          <UserMenu
            name={name}
            email={email}
            role={role}
            onOpenProfile={() => setProfileOpen(true)}
            variant="dark"
          />
        </div>
      </header>

      {/* ── Barra de acciones ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4eaf2] bg-white px-5 py-3">
        <button
          onClick={() => setModal({ mode: "create" })}
          data-tour="customers-new"
          className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e]"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Nuevo cliente</span>
          <span className="sm:hidden">Nuevo</span>
        </button>

        <div className="relative flex-1 sm:max-w-[260px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="h-[36px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] pl-8 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
          />
        </div>

        {/* Filtro por etiqueta */}
        {activeLabels.length > 0 && (
          <div className="flex overflow-hidden rounded-[10px] border border-[#dde4ee] bg-[#f8fafc]">
            <button
              onClick={() => setLabelFilter("all")}
              className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                labelFilter === "all"
                  ? "bg-[#d9622c] text-white"
                  : "text-[#475569] hover:bg-[#f1f5f9]"
              }`}
            >
              Todas
            </button>
            {activeLabels.map((lb) => (
              <button
                key={lb.id}
                onClick={() => setLabelFilter(lb.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  labelFilter === lb.id
                    ? "bg-[#d9622c] text-white"
                    : "text-[#475569] hover:bg-[#f1f5f9]"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: labelFilter === lb.id ? "white" : lb.color,
                  }}
                />
                {lb.name}
              </button>
            ))}
          </div>
        )}

        {/* Filtro activo/todos */}
        <div className="flex overflow-hidden rounded-[10px] border border-[#dde4ee] bg-[#f8fafc]">
          {(["active", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 text-[12px] font-medium transition-colors ${
                filter === tab
                  ? "bg-[#d9622c] text-white"
                  : "text-[#475569] hover:bg-[#f1f5f9]"
              }`}
            >
              {tab === "active" ? "Activos" : "Todos"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[12px] text-[#94a3b8]">
          {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 p-5">
        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            value={activeCount}
            label="Clientes activos"
            sub={`de ${customers.length} registrados`}
          />
          <StatCard
            value={activeLabels.length}
            label="Etiquetas creadas"
            sub="configurables por vos"
          />
          <StatCard
            value={totalQuotes}
            label="Presupuestos"
            sub={converted.length > 0 ? `${converted.length} aceptados` : "ninguno aceptado aún"}
          />
          <StatCard
            value={`${conversionRate}%`}
            label="Conversión"
            sub="aceptados / no cancelados"
            accent
          />
        </div>

        {/* ── Loading / Error ─────────────────────────────────────────────── */}
        {isLoading && (
          <p className="py-12 text-center text-[13px] text-[#94a3b8]">
            Cargando clientes...
          </p>
        )}
        {error && (
          <p className="py-12 text-center text-[13px] text-red-500">
            {error.message}
          </p>
        )}

        {/* ── Tabla desktop ───────────────────────────────────────────────── */}
        {!isLoading && !error && (
          <div className="hidden overflow-hidden rounded-[12px] border border-[#e8ecf2] bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                  {["Cliente", "Etiqueta", "Email", "Teléfono", "Estado", "Acciones"].map((h) => (
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
                    <td
                      colSpan={6}
                      className="py-12 text-center text-[13px] text-[#94a3b8]"
                    >
                      {search || labelFilter !== "all"
                        ? "Sin resultados para el filtro aplicado."
                        : filter === "active"
                        ? "No hay clientes activos. ¡Creá el primero!"
                        : "No hay clientes registrados."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      label={customer.label_id ? labelsMap.get(customer.label_id) : undefined}
                      selected={selectedId === customer.id}
                      onSelect={() =>
                        setSelectedId((prev) =>
                          prev === customer.id ? null : customer.id
                        )
                      }
                      onEdit={() => setModal({ mode: "edit", customer })}
                    />
                  ))
                )}
              </tbody>
            </table>

            {selectedCustomer && (
              <CustomerDetailPanel
                customer={selectedCustomer}
                label={selectedCustomer.label_id ? labelsMap.get(selectedCustomer.label_id) : undefined}
                onEdit={() => setModal({ mode: "edit", customer: selectedCustomer })}
                onToggleActive={() => handleToggleActive(selectedCustomer)}
                isToggling={isDeactivating || isReactivating}
              />
            )}
          </div>
        )}

        {/* ── Cards mobile ────────────────────────────────────────────────── */}
        {!isLoading && !error && (
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-[#94a3b8]">
                {search || labelFilter !== "all"
                  ? "Sin resultados."
                  : filter === "active"
                  ? "No hay clientes activos."
                  : "No hay clientes registrados."}
              </p>
            ) : (
              filtered.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  label={customer.label_id ? labelsMap.get(customer.label_id) : undefined}
                  onEdit={() => setModal({ mode: "edit", customer })}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Modales ─────────────────────────────────────────────────────────── */}
      {modal && (
        <CustomerFormModal
          mode={modal.mode}
          customer={modal.customer}
          onClose={() => setModal(null)}
        />
      )}

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
