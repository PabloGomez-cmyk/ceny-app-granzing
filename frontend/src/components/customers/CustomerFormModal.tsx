"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";
import { useCreateCustomer, useUpdateCustomer, useCustomerLabels } from "@/hooks/useCustomers";
import type { Customer, CustomerLabel } from "@/lib/api/customers";

export type CustomerModalMode = "create" | "edit";

// ── Provincias de Argentina ───────────────────────────────────────────────────

const PROVINCIAS = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
  "Ciudad Autónoma de Buenos Aires",
];

// ── Helpers de UI ─────────────────────────────────────────────────────────────

const INPUT_CLS =
  "h-[36px] w-full rounded-[8px] border border-[#dde4ee] bg-white px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20";

const SELECT_CLS =
  "h-[36px] w-full rounded-[8px] border border-[#dde4ee] bg-white px-3 text-[13px] text-[#0f172a] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20 appearance-none";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-[#374151]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">
        {children}
      </span>
      <div className="h-px flex-1 bg-[#f1f5f9]" />
    </div>
  );
}

// ── Label picker ──────────────────────────────────────────────────────────────

function LabelPicker({
  labels,
  selectedId,
  onChange,
}: {
  labels: CustomerLabel[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = labels.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[36px] w-full items-center justify-between rounded-[8px] border border-[#dde4ee] bg-white px-3 text-[13px] text-[#0f172a] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: selected.color }} />
            {selected.name}
          </span>
        ) : (
          <span className="text-[#94a3b8]">Sin etiqueta</span>
        )}
        <ChevronDown size={14} className="text-[#94a3b8]" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[8px] border border-[#e8ecf2] bg-white shadow-lg">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className="flex h-9 w-full items-center px-3 text-[13px] text-[#94a3b8] hover:bg-[#f8fafc]"
          >
            Sin etiqueta
          </button>
          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => { onChange(label.id); setOpen(false); }}
              className="flex h-9 w-full items-center gap-2 px-3 text-[13px] text-[#0f172a] hover:bg-[#f8fafc]"
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: label.color }} />
              {label.name}
            </button>
          ))}
          {labels.length === 0 && (
            <p className="px-3 py-2.5 text-[12px] text-[#94a3b8]">
              No hay etiquetas. Creá una desde Configuración.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Drawer principal ──────────────────────────────────────────────────────────

interface Props {
  mode: CustomerModalMode;
  customer?: Customer;
  onClose: () => void;
}

export default function CustomerFormModal({ mode, customer, onClose }: Props) {
  const { data: labels = [] } = useCustomerLabels();
  const activeLabels = labels.filter((l) => l.is_active);

  const { mutate: createCustomer, isPending: isCreating, error: createError } = useCreateCustomer();
  const { mutate: updateCustomer, isPending: isUpdating, error: updateError } = useUpdateCustomer();

  // Datos del cliente
  const [name, setName] = useState(customer?.name ?? "");
  const [labelId, setLabelId] = useState<string | null>(customer?.label_id ?? null);
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");

  // Localización
  const [city, setCity] = useState(customer?.city ?? "");
  const [province, setProvince] = useState(customer?.province ?? "");

  // Dirección
  const [address, setAddress] = useState(customer?.address ?? "");
  const [neighborhood, setNeighborhood] = useState(customer?.neighborhood ?? "");
  const [postalCode, setPostalCode] = useState(customer?.postal_code ?? "");

  // Notas
  const [notes, setNotes] = useState(customer?.notes ?? "");

  const isPending = isCreating || isUpdating;
  const error = createError ?? updateError;

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      province: province || null,
      neighborhood: neighborhood.trim() || null,
      postal_code: postalCode.trim() || null,
      label_id: labelId,
      notes: notes.trim() || null,
    };

    if (mode === "create") {
      createCustomer(payload, { onSuccess: onClose });
    } else if (customer) {
      updateCustomer(
        {
          id: customer.id,
          data: { ...payload, clear_label: labelId === null },
        },
        { onSuccess: onClose }
      );
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#f1f5f9] px-6 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-[#0f172a]">
              {mode === "create" ? "Nuevo cliente" : "Editar cliente"}
            </h2>
            <p className="text-[12px] text-[#94a3b8]">
              {mode === "create"
                ? "Completá los datos del nuevo cliente"
                : `Editando: ${customer?.name}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#374151]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form body — scrollable */}
        <form
          id="customer-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5"
        >
          <div className="flex flex-col gap-5">
            {/* ── Datos del cliente ─────────────────────────── */}
            <SectionTitle>Datos del cliente</SectionTitle>

            <Field label="Nombre completo / Razón social" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="María González"
                required
                maxLength={200}
                className={INPUT_CLS}
              />
            </Field>

            <Field label="Etiqueta">
              <LabelPicker
                labels={activeLabels}
                selectedId={labelId}
                onChange={setLabelId}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="m.gonzalez@email.com"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 351 555-1234"
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            {/* ── Localización ─────────────────────────────── */}
            <SectionTitle>Localización</SectionTitle>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Ciudad">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Córdoba"
                  maxLength={100}
                  className={INPUT_CLS}
                />
              </Field>

              <Field label="Provincia">
                <div className="relative">
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="">Seleccionar</option>
                    {PROVINCIAS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"
                  />
                </div>
              </Field>

              <Field label="País">
                <input
                  value="Argentina"
                  disabled
                  className={`${INPUT_CLS} cursor-not-allowed bg-[#f8fafc] text-[#94a3b8]`}
                />
              </Field>
            </div>

            {/* ── Dirección ────────────────────────────────── */}
            <SectionTitle>Dirección</SectionTitle>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Calle y número">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Av. Colón 1234"
                  maxLength={200}
                  className={INPUT_CLS}
                />
              </Field>

              <Field label="Barrio / Localidad">
                <input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Nueva Córdoba"
                  maxLength={200}
                  className={INPUT_CLS}
                />
              </Field>

              <Field label="Código postal">
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="5000"
                  maxLength={20}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            {/* ── Notas ────────────────────────────────────── */}
            <SectionTitle>Notas</SectionTitle>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información adicional sobre el cliente..."
              rows={3}
              maxLength={2000}
              className="w-full resize-none rounded-[8px] border border-[#dde4ee] bg-white px-3 py-2 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20"
            />

            {error && (
              <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[12px] text-red-600">
                {error.message}
              </p>
            )}
          </div>
        </form>

        {/* Footer — sticky */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#f1f5f9] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-[#e2e6f0] px-4 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#f1f5f9]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={isPending || !name.trim()}
            className="rounded-[8px] bg-[#0f6e50] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#0a5a40] disabled:opacity-50"
          >
            {isPending
              ? mode === "create"
                ? "Creando..."
                : "Guardando..."
              : mode === "create"
              ? "Crear cliente"
              : "Guardar cambios"}
          </button>
        </div>
      </div>
    </>
  );
}
