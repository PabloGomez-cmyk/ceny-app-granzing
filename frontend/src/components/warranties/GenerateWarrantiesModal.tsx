"use client";

import { useState, useEffect } from "react";
import { X, ShieldCheck, AlertCircle, Loader2, Car } from "lucide-react";
import { useGenerateWarranties } from "@/hooks/useWarranties";

interface Props {
  quoteId: string;
  quoteNumber: string;
  onClose: () => void;
}

export default function GenerateWarrantiesModal({ quoteId, quoteNumber, onClose }: Props) {
  const generateWarranties = useGenerateWarranties();

  const [vehicleModel, setVehicleModel] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vehicleModel.trim() || !licensePlate.trim()) {
      setError("Completá el modelo del auto y la patente para generar las garantías.");
      return;
    }
    try {
      await generateWarranties.mutateAsync({
        quoteId,
        payload: {
          vehicle_model: vehicleModel.trim(),
          license_plate: licensePlate.trim(),
        },
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al generar las garantías";
      setError(msg);
    }
  }

  const isBusy = generateWarranties.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[480px] rounded-[16px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8ecf2] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#fbeee1]">
              <ShieldCheck size={15} className="text-[#d9622c]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0f172a]">Generar garantías</p>
              <p className="text-[11px] text-[#94a3b8]">{quoteNumber} · Polarizado automotriz</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#94a3b8] hover:bg-[#f1f5f9]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="flex items-center gap-1.5 rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[11px] text-[#64748b]">
              <Car size={13} className="text-[#d9622c]" />
              Datos del vehículo intervenido — quedan documentados en la garantía y el email.
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#374151]">
                Modelo del auto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Toyota Corolla 2021"
                className="h-[38px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#374151]">
                Patente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="AB123CD"
                className="h-[38px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-[12px] text-red-600">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="rounded-[10px] border border-[#dde4ee] px-4 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isBusy || !vehicleModel.trim() || !licensePlate.trim()}
                className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
              >
                {isBusy ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={13} />
                    Generar garantías
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
