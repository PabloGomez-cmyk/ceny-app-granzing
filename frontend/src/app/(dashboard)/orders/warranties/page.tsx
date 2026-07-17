"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Search, ShieldCheck, ShieldOff } from "lucide-react";
import UserMenu from "@/components/layout/UserMenu";
import ProfileModal from "@/components/profile/ProfileModal";
import { useWarranties } from "@/hooks/useWarranties";

function StatCard({ value, label, sub, accent }: { value: string | number; label: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-[12px] border bg-white p-4 ${accent ? "border-l-4 border-l-amber-400 border-[#e8ecf2]" : "border-[#e8ecf2]"}`}>
      <p className={`font-bold text-[28px] leading-none ${accent ? "text-amber-500" : "text-[#0f172a]"}`}>{value}</p>
      <p className="mt-1 text-[13px] font-semibold text-[#374151]">{label}</p>
      <p className="text-[11px] text-[#94a3b8]">{sub}</p>
    </div>
  );
}

export default function WarrantiesPage() {
  const { data: session, status } = useSession();
  const role = session?.role;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const userId = session?.userId;

  const { data: warranties = [], isLoading } = useWarranties();

  const [search, setSearch] = useState("");
  const [filterValid, setFilterValid] = useState<"ALL" | "VALID" | "EXPIRED">("ALL");
  const [profileOpen, setProfileOpen] = useState(false);

  if (status === "loading") return null;

  const filtered = warranties.filter((w) => {
    const matchValid =
      filterValid === "ALL" ||
      (filterValid === "VALID" && w.is_valid) ||
      (filterValid === "EXPIRED" && !w.is_valid);
    const q = search.toLowerCase();
    const productName = String(w.product_snapshot.name ?? "").toLowerCase();
    const customerName = w.customer_snapshot
      ? String((w.customer_snapshot as Record<string, string>).name ?? "").toLowerCase()
      : "";
    const matchSearch =
      !q ||
      w.warranty_number.toLowerCase().includes(q) ||
      productName.includes(q) ||
      customerName.includes(q) ||
      (w.vehicle_model ?? "").toLowerCase().includes(q) ||
      (w.license_plate ?? "").toLowerCase().includes(q);
    return matchValid && matchSearch;
  });

  const validCount = warranties.filter((w) => w.is_valid).length;
  const expiredCount = warranties.filter((w) => !w.is_valid).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* Header */}
      <header className="flex items-center justify-between bg-[#d9622c] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-bold text-[17px] text-white">Garantías emitidas</h1>
        </div>
        <UserMenu name={name} email={email} role={role} onOpenProfile={() => setProfileOpen(true)} variant="dark" />
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4eaf2] bg-white px-5 py-3">
        <div className="relative flex-1 sm:max-w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, producto o cliente..."
            className="h-[36px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] pl-8 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
          />
        </div>

        <div className="flex overflow-x-auto overflow-y-hidden rounded-[10px] border border-[#dde4ee] bg-[#f8fafc]">
          {(["ALL", "VALID", "EXPIRED"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterValid(v)}
              className={`whitespace-nowrap px-3 py-1.5 text-[12px] font-medium transition-colors ${filterValid === v ? "bg-[#d9622c] text-white" : "text-[#475569] hover:bg-[#f1f5f9]"}`}
            >
              {v === "ALL" ? "Todas" : v === "VALID" ? "Vigentes" : "Vencidas"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[12px] text-[#94a3b8]">
          {filtered.length} garantía{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 p-5">
        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard value={warranties.length} label="Total emitidas" sub="garantías generadas" />
          <StatCard value={validCount} label="Vigentes" sub="dentro del período de cobertura" accent />
          <StatCard value={expiredCount} label="Vencidas" sub="fuera del período de cobertura" />
        </div>

        {isLoading && (
          <p className="py-8 text-center text-[13px] text-[#94a3b8]">Cargando garantías...</p>
        )}

        {!isLoading && (
          <div className="hidden overflow-hidden rounded-[12px] border border-[#e8ecf2] bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                  {["N° Garantía", "Venta", "Cliente", "Producto", "Emisión", "Vencimiento", "Estado"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[13px] text-[#94a3b8]">
                      {warranties.length === 0
                        ? "Todavía no se emitieron garantías."
                        : "Sin resultados para el filtro aplicado."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => {
                    const customerName = w.customer_snapshot
                      ? String((w.customer_snapshot as Record<string, string>).name ?? "Sin cliente")
                      : "Sin cliente";
                    const productName = String(w.product_snapshot.name ?? "—");
                    return (
                      <tr key={w.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafb]">
                        <td className="py-3 pl-5 pr-4 text-[13px] font-bold text-[#0f172a]">{w.warranty_number}</td>
                        <td className="px-4 py-3 text-[13px]">
                          <Link href={`/orders/${w.quote_id}` as never} className="text-[#d9622c] hover:underline">
                            Ver venta
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#374151]">{customerName}</td>
                        <td className="px-4 py-3 text-[13px] text-[#374151]">
                          {productName}
                          {(w.vehicle_model || w.license_plate) && (
                            <p className="mt-0.5 text-[11px] text-[#94a3b8]">
                              {w.vehicle_model ?? "—"}{w.license_plate ? ` · ${w.license_plate}` : ""}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#64748b]">
                          {new Date(w.created_at).toLocaleDateString("es-AR")}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#64748b]">{w.expires_at}</td>
                        <td className="px-4 py-3 pr-5">
                          {w.is_valid ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <ShieldCheck size={12} />
                              Vigente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
                              <ShieldOff size={12} />
                              Vencida
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Cards mobile */}
        {!isLoading && (
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((w) => {
              const customerName = w.customer_snapshot
                ? String((w.customer_snapshot as Record<string, string>).name ?? "Sin cliente")
                : "Sin cliente";
              const productName = String(w.product_snapshot.name ?? "—");
              return (
                <Link
                  key={w.id}
                  href={`/orders/${w.quote_id}` as never}
                  className="rounded-[12px] border border-[#e8ecf2] bg-white p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[13px] font-bold text-[#0f172a]">{w.warranty_number}</p>
                      <p className="text-[12px] text-[#64748b]">{productName} · {customerName}</p>
                      {(w.vehicle_model || w.license_plate) && (
                        <p className="text-[11px] text-[#94a3b8]">
                          {w.vehicle_model ?? "—"}{w.license_plate ? ` · ${w.license_plate}` : ""}
                        </p>
                      )}
                    </div>
                    {w.is_valid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Vigente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        Vencida
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#f1f5f9] pt-3 text-[11px] text-[#94a3b8]">
                    <span>Emitida {new Date(w.created_at).toLocaleDateString("es-AR")}</span>
                    <span>Vence {w.expires_at}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {profileOpen && userId && (
        <ProfileModal userId={userId} userName={name} userEmail={email} onClose={() => setProfileOpen(false)} />
      )}
    </div>
  );
}
