"use client";

import { Car, Layers } from "lucide-react";
import type { SaleType } from "@/lib/api/quotes";

export function SaleTypeSelector({
  onSelect,
}: {
  onSelect: (type: SaleType) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 py-8">
      <div className="text-center">
        <h2 className="text-[17px] font-bold text-[#0f172a]">¿Qué tipo de venta querés crear?</h2>
        <p className="mt-1 text-[13px] text-[#94a3b8]">Elegí el flujo según el tipo de instalación.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("ARCHITECTURE")}
          className="flex flex-col items-center gap-3 rounded-[16px] border-2 border-[#e8ecf2] bg-white px-6 py-8 text-center transition-all hover:border-[#d9622c] hover:bg-[#fbeee1]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee1] text-[#d9622c]">
            <Layers size={22} />
          </span>
          <span className="text-[15px] font-bold text-[#0f172a]">Arquitectura</span>
          <span className="text-[12px] text-[#94a3b8]">
            Láminas solares para vidrios de proyectos: medidas, plan de cortes y cálculo por vidrio.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelect("AUTOMOTIVE")}
          className="flex flex-col items-center gap-3 rounded-[16px] border-2 border-[#e8ecf2] bg-white px-6 py-8 text-center transition-all hover:border-[#d9622c] hover:bg-[#fbeee1]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee1] text-[#d9622c]">
            <Car size={22} />
          </span>
          <span className="text-[15px] font-bold text-[#0f172a]">Automotriz</span>
          <span className="text-[12px] text-[#94a3b8]">
            Polarizado automotriz: elegí el producto, cargá los m² y el precio de venta.
          </span>
        </button>
      </div>
    </div>
  );
}
