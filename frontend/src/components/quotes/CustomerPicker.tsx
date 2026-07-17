"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useCustomers, useCreateCustomer, useCustomerLabels } from "@/hooks/useCustomers";

export function CustomerPicker({
  customerId,
  setCustomerId,
}: {
  customerId: string;
  setCustomerId: (id: string) => void;
}) {
  const { data: customers = [] } = useCustomers();
  const { data: labels = [] } = useCustomerLabels();
  const createCustomer = useCreateCustomer();

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "", phone: "", email: "",
    address: "", city: "", province: "",
    neighborhood: "", postal_code: "", label_id: "", notes: "",
  });
  const [newClientError, setNewClientError] = useState("");

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0f172a]">
          <Users size={16} className="text-[#d9622c]" />
          Cliente
        </div>
        <button
          type="button"
          onClick={() => { setNewClientOpen(true); setNewClientError(""); setNewClientForm({ name: "", phone: "", email: "", address: "", city: "", province: "", neighborhood: "", postal_code: "", label_id: "", notes: "" }); }}
          className="flex items-center gap-1 text-[12px] font-semibold text-[#d9622c] hover:text-[#b74e1e]"
        >
          <Plus size={13} />
          Nuevo cliente
        </button>
      </div>

      {newClientOpen && (
        <div className="mb-4 rounded-[10px] border border-[#d9622c]/20 bg-[#fbeee1] p-4">
          <p className="mb-4 text-[12px] font-semibold text-[#d9622c]">Crear nuevo cliente</p>

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Nombre *</label>
              <input
                type="text"
                value={newClientForm.name}
                onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                placeholder="Juan Pérez"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Teléfono</label>
              <input
                type="text"
                value={newClientForm.phone}
                onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                placeholder="+54 9 11 ..."
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Email</label>
              <input
                type="email"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                placeholder="juan@ejemplo.com"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Dirección</label>
              <input
                type="text"
                value={newClientForm.address}
                onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })}
                placeholder="Av. Corrientes 1234"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Barrio</label>
              <input
                type="text"
                value={newClientForm.neighborhood}
                onChange={(e) => setNewClientForm({ ...newClientForm, neighborhood: e.target.value })}
                placeholder="Palermo"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Ciudad</label>
              <input
                type="text"
                value={newClientForm.city}
                onChange={(e) => setNewClientForm({ ...newClientForm, city: e.target.value })}
                placeholder="Buenos Aires"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Provincia</label>
              <input
                type="text"
                value={newClientForm.province}
                onChange={(e) => setNewClientForm({ ...newClientForm, province: e.target.value })}
                placeholder="Buenos Aires"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Código postal</label>
              <input
                type="text"
                value={newClientForm.postal_code}
                onChange={(e) => setNewClientForm({ ...newClientForm, postal_code: e.target.value })}
                placeholder="1414"
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Etiqueta</label>
              <select
                value={newClientForm.label_id}
                onChange={(e) => setNewClientForm({ ...newClientForm, label_id: e.target.value })}
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
              >
                <option value="">Sin etiqueta</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#64748b]">Notas</label>
              <input
                type="text"
                value={newClientForm.notes}
                onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })}
                placeholder="Observaciones del cliente..."
                className="w-full rounded-[8px] border border-[#dde4ee] bg-white px-2.5 py-2 text-[12px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none"
              />
            </div>
          </div>

          {newClientError && (
            <p className="mb-2 text-[11px] text-red-600">{newClientError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={createCustomer.isPending}
              onClick={async () => {
                if (!newClientForm.name.trim()) { setNewClientError("El nombre es obligatorio."); return; }
                if (newClientForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClientForm.email.trim())) { setNewClientError("El email no es válido. Ejemplo: juan@ejemplo.com"); return; }
                try {
                  const created = await createCustomer.mutateAsync({
                    name: newClientForm.name.trim(),
                    phone: newClientForm.phone.trim() || null,
                    email: newClientForm.email.trim() || null,
                    address: newClientForm.address.trim() || null,
                    neighborhood: newClientForm.neighborhood.trim() || null,
                    city: newClientForm.city.trim() || null,
                    province: newClientForm.province.trim() || null,
                    postal_code: newClientForm.postal_code.trim() || null,
                    label_id: newClientForm.label_id || null,
                    notes: newClientForm.notes.trim() || null,
                  });
                  setCustomerId(created.id);
                  setNewClientOpen(false);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "No se pudo crear el cliente.";
                  setNewClientError(msg);
                }
              }}
              className="rounded-[8px] bg-[#d9622c] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60 hover:bg-[#b74e1e]"
            >
              {createCustomer.isPending ? "Guardando..." : "Guardar cliente"}
            </button>
            <button
              type="button"
              onClick={() => setNewClientOpen(false)}
              className="rounded-[8px] border border-[#dde4ee] px-4 py-1.5 text-[12px] text-[#64748b] hover:bg-[#f1f5f9]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <select
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        className="w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 py-2 text-[13px] text-[#0f172a] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
      >
        <option value="">Sin cliente asignado</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {selectedCustomer && (
        <div className="mt-3 rounded-[10px] bg-blue-50 px-4 py-3 text-[12px] text-blue-800">
          <p className="font-semibold">{selectedCustomer.name}</p>
          {selectedCustomer.phone && <p className="text-blue-600">{selectedCustomer.phone}</p>}
          {selectedCustomer.address && <p className="text-blue-600">{selectedCustomer.address}</p>}
        </div>
      )}
    </div>
  );
}
