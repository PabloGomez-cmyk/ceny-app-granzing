"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Plus,
  Search,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import {
  useCustomerLabels,
  useCreateCustomerLabel,
  useUpdateCustomerLabel,
  useDeleteCustomerLabel,
} from "@/hooks/useCustomers";
import UserMenu from "@/components/layout/UserMenu";
import ProfileModal from "@/components/profile/ProfileModal";
import type { CustomerLabel } from "@/lib/api/customers";

// ── Paleta de colores ─────────────────────────────────────────────────────────

const PALETTE = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#a855f7",
];

const PAGE_SIZE = 20;

// ── Selector de color inline ──────────────────────────────────────────────────

function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      // Cerrar si el click no es sobre el botón ni sobre el popover
      if (btnRef.current && !btnRef.current.contains(target)) {
        const popover = document.getElementById("color-picker-popover");
        if (popover && !popover.contains(target)) setPos(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [pos]);

  function open(e: React.MouseEvent) {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const rect = btnRef.current!.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={open}
        className="h-6 w-6 rounded-[4px] border-2 border-white shadow-sm ring-1 ring-black/10 transition-transform hover:scale-110"
        style={{ background: color }}
      />
      {pos && (
        <div
          id="color-picker-popover"
          className="fixed z-[9999] grid grid-cols-6 gap-1.5 rounded-[10px] border border-[#e8ecf2] bg-white p-2 shadow-xl"
          style={{ top: pos.top, right: pos.right }}
        >
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(c); setPos(null); }}
              className="relative flex h-6 w-6 items-center justify-center rounded-[4px] transition-transform hover:scale-110"
              style={{ background: c }}
            >
              {color === c && <Check size={11} className="text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Fila de etiqueta ──────────────────────────────────────────────────────────

function LabelRow({
  label,
  selected,
  onSelect,
  onSave,
  onDelete,
  isSaving,
}: {
  label: CustomerLabel;
  selected: boolean;
  onSelect: (id: string, v: boolean) => void;
  onSave: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cuando se activa la edición, foco en el input
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleSave() {
    if (!name.trim()) { setName(label.name); setEditing(false); return; }
    onSave(label.id, name.trim(), color);
    setEditing(false);
  }

  function handleColorChange(c: string) {
    setColor(c);
    onSave(label.id, name.trim() || label.name, c);
  }

  return (
    <tr
      className={`group border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafb] ${
        editing ? "bg-[#fbeee1]" : ""
      }`}
      onClick={() => !editing && setEditing(true)}
    >
      {/* Checkbox */}
      <td className="w-10 py-2.5 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(label.id, e.target.checked)}
          className="h-4 w-4 rounded border-[#cbd5e1] accent-[#d9622c]"
        />
      </td>

      {/* Nombre */}
      <td className="py-2.5 pr-3">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") { setName(label.name); setEditing(false); }
            }}
            onBlur={handleSave}
            maxLength={50}
            className="w-full max-w-[400px] rounded-[6px] border border-[#d9622c] bg-white px-2 py-1 text-[13px] text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/30"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="cursor-text text-[13px] text-[#0f172a]">{label.name}</span>
        )}
      </td>

      {/* Color */}
      <td className="w-24 py-2.5 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-3">
          <ColorPicker
            color={color}
            onChange={handleColorChange}
          />
          {/* Eliminar */}
          {confirmDelete ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onDelete(label.id)}
                className="rounded-[6px] bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-600"
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-[6px] px-2 py-0.5 text-[11px] text-[#64748b] hover:bg-[#f1f5f9]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[#cbd5e1] opacity-100 transition-opacity hover:bg-red-50 hover:text-red-400 lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Fila de nueva etiqueta ────────────────────────────────────────────────────

function NewLabelRow({
  onSave,
  onCancel,
  isSaving,
}: {
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSave() {
    if (!name.trim()) { onCancel(); return; }
    onSave(name.trim(), color);
  }

  return (
    <tr className="border-b border-[#f1f5f9] bg-[#fbeee1]">
      <td className="w-10 py-2.5 pl-4 pr-2">
        <div className="h-4 w-4" />
      </td>
      <td className="py-2.5 pr-3">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Nombre de la etiqueta..."
          maxLength={50}
          className="w-full max-w-[400px] rounded-[6px] border border-[#d9622c] bg-white px-2 py-1 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/30"
        />
      </td>
      <td className="w-24 py-2.5 pr-5 text-right">
        <div className="flex items-center justify-end gap-3">
          <ColorPicker color={color} onChange={setColor} />
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="rounded-[6px] bg-[#d9622c] px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
          >
            {isSaving ? "..." : "Guardar"}
          </button>
          <button
            onClick={onCancel}
            className="text-[11px] text-[#94a3b8] hover:text-[#374151]"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function LabelsSettingsPage() {
  const { data: session } = useSession();
  const role = session?.role;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const userId = session?.userId;

  const { data: labels = [], isLoading } = useCustomerLabels();
  const { mutate: createLabel, isPending: isCreating } = useCreateCustomerLabel();
  const { mutate: updateLabel } = useUpdateCustomerLabel();
  const { mutate: deleteLabel } = useDeleteCustomerLabel();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNewRow, setShowNewRow] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const activeLabels = labels.filter((l) => l.is_active);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activeLabels.filter((l) => !q || l.name.toLowerCase().includes(q));
  }, [activeLabels, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allSelected =
    paginated.length > 0 && paginated.every((l) => selected.has(l.id));

  function toggleAll(v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      paginated.forEach((l) => (v ? next.add(l.id) : next.delete(l.id)));
      return next;
    });
  }

  function toggleOne(id: string, v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      v ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function handleSave(id: string, name: string, color: string) {
    updateLabel({ id, data: { name, color } });
  }

  function handleDelete(id: string) {
    deleteLabel(id);
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function handleCreate(name: string, color: string) {
    createLabel({ name, color }, { onSuccess: () => setShowNewRow(false) });
  }

  // Resetear página al buscar
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between bg-[#d9622c] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2 text-white">
            <Link
              href="/customers"
              className="text-[14px] font-medium text-white/70 hover:text-white"
            >
              Clientes
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-[14px] font-medium text-white/70">Configuración</span>
            <span className="text-white/40">/</span>
            <span className="text-[14px] font-bold">Etiquetas</span>
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

      {/* ── Barra de acciones ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[#e4eaf2] bg-white px-5 py-3">
        <button
          onClick={() => { setShowNewRow(true); setPage(1); }}
          disabled={showNewRow}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
        >
          <Plus size={14} />
          Nuevo
        </button>

        <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]">
          Etiquetas de contacto
          <Settings size={14} className="text-[#94a3b8]" />
        </div>

        <div className="relative ml-auto max-w-[320px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="h-[34px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] pl-8 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
          />
        </div>

        {/* Paginación */}
        <div className="flex shrink-0 items-center gap-2 text-[12px] text-[#64748b]">
          <span>
            {filtered.length === 0
              ? "0"
              : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filtered.length)}`}
            {" / "}
            {filtered.length}
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#e2e6f0] text-[#374151] hover:bg-[#f1f5f9] disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#e2e6f0] text-[#374151] hover:bg-[#f1f5f9] disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 p-5">
        <div className="overflow-hidden rounded-[12px] border border-[#e8ecf2] bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[380px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="w-10 py-2.5 pl-4 pr-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="h-4 w-4 rounded border-[#cbd5e1] accent-[#d9622c]"
                  />
                </th>
                <th className="py-2.5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Nombre en pantalla
                </th>
                <th className="w-24 py-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Color
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Fila nueva en la parte superior */}
              {showNewRow && (
                <NewLabelRow
                  onSave={handleCreate}
                  onCancel={() => setShowNewRow(false)}
                  isSaving={isCreating}
                />
              )}

              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-[13px] text-[#94a3b8]">
                    Cargando etiquetas...
                  </td>
                </tr>
              ) : paginated.length === 0 && !showNewRow ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-[13px] text-[#94a3b8]">
                    {search ? "Sin resultados para la búsqueda." : "No hay etiquetas. Creá la primera."}
                  </td>
                </tr>
              ) : (
                paginated.map((label) => (
                  <LabelRow
                    key={label.id}
                    label={label}
                    selected={selected.has(label.id)}
                    onSelect={toggleOne}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    isSaving={false}
                  />
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Hint */}
        {!isLoading && activeLabels.length > 0 && (
          <p className="mt-3 text-[11px] text-[#94a3b8]">
            Hacé clic en una fila para editar el nombre · Hacé clic en el color para cambiarlo
          </p>
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
