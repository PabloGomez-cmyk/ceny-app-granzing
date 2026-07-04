"use client";

import { useState } from "react";
import { X, Plus, Pencil, Trash2, Check } from "lucide-react";
import {
  useCustomerLabels,
  useCreateCustomerLabel,
  useUpdateCustomerLabel,
  useDeleteCustomerLabel,
} from "@/hooks/useCustomers";
import type { CustomerLabel } from "@/lib/api/customers";

const PALETTE = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#a855f7",
];

function ColorDot({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: color }}
    />
  );
}

function LabelBadge({ label }: { label: CustomerLabel }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: label.color }}
    >
      {label.name}
    </span>
  );
}

function LabelForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: { name: string; color: string };
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]);

  return (
    <div className="rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] p-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la etiqueta..."
        maxLength={50}
        className="mb-3 h-[36px] w-full rounded-[8px] border border-[#dde4ee] bg-white px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20"
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="relative flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{ background: c }}
          >
            {color === c && <Check size={12} className="text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#94a3b8]">
          Vista previa:{" "}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
            style={{ background: color }}
          >
            {name || "Etiqueta"}
          </span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9]"
          >
            Cancelar
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim(), color)}
            disabled={!name.trim() || isSaving}
            className="rounded-[8px] bg-[#0f6e50] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0a5a40] disabled:opacity-50"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LabelsSettingsModal({ onClose }: { onClose: () => void }) {
  const { data: labels = [], isLoading } = useCustomerLabels();
  const { mutate: createLabel, isPending: isCreating } = useCreateCustomerLabel();
  const { mutate: updateLabel, isPending: isUpdating } = useUpdateCustomerLabel();
  const { mutate: deleteLabel, isPending: isDeleting } = useDeleteCustomerLabel();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeLabels = labels.filter((l) => l.is_active);

  function handleCreate(name: string, color: string) {
    createLabel({ name, color }, { onSuccess: () => setShowForm(false) });
  }

  function handleUpdate(id: string, name: string, color: string) {
    updateLabel({ id, data: { name, color } }, { onSuccess: () => setEditingId(null) });
  }

  function handleDelete(id: string) {
    deleteLabel(id, { onSuccess: () => setConfirmDeleteId(null) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[480px] rounded-[16px] bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-[#0f172a]">Etiquetas de clientes</h2>
            <p className="text-[12px] text-[#94a3b8]">
              Organizá tus clientes con etiquetas personalizadas
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#374151]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {isLoading ? (
            <p className="py-8 text-center text-[13px] text-[#94a3b8]">Cargando etiquetas...</p>
          ) : (
            <>
              {/* Lista de etiquetas */}
              <div className="mb-4 flex flex-col gap-2">
                {activeLabels.length === 0 && !showForm && (
                  <p className="py-4 text-center text-[13px] text-[#94a3b8]">
                    No hay etiquetas. Creá la primera.
                  </p>
                )}

                {activeLabels.map((label) =>
                  editingId === label.id ? (
                    <LabelForm
                      key={label.id}
                      initial={{ name: label.name, color: label.color }}
                      onSave={(name, color) => handleUpdate(label.id, name, color)}
                      onCancel={() => setEditingId(null)}
                      isSaving={isUpdating}
                    />
                  ) : (
                    <div
                      key={label.id}
                      className="flex items-center justify-between rounded-[10px] border border-[#e8ecf2] bg-white px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <ColorDot color={label.color} size={12} />
                        <span className="text-[13px] font-medium text-[#0f172a]">{label.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(label.id);
                            setShowForm(false);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#374151]"
                        >
                          <Pencil size={13} />
                        </button>
                        {confirmDeleteId === label.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(label.id)}
                              disabled={isDeleting}
                              className="rounded-[6px] bg-red-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              Eliminar
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-[6px] px-2 py-1 text-[11px] text-[#64748b] hover:bg-[#f1f5f9]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(label.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94a3b8] hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Formulario nueva etiqueta */}
              {showForm ? (
                <LabelForm
                  onSave={handleCreate}
                  onCancel={() => setShowForm(false)}
                  isSaving={isCreating}
                />
              ) : (
                <button
                  onClick={() => {
                    setShowForm(true);
                    setEditingId(null);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#cbd5e1] py-2.5 text-[13px] font-medium text-[#64748b] transition-colors hover:border-[#0f6e50] hover:bg-[#f0faf6] hover:text-[#0f6e50]"
                >
                  <Plus size={14} />
                  Nueva etiqueta
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#f1f5f9] px-5 py-3">
          <p className="text-[11px] text-[#94a3b8]">
            Las etiquetas eliminadas se desvinculan automáticamente de los clientes.
          </p>
        </div>
      </div>
    </div>
  );
}
