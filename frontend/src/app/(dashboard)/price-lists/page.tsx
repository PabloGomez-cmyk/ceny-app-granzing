"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, RotateCcw } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import {
  useEffectivePriceList,
  useSetPriceOverride,
  useDeletePriceOverride,
} from "@/hooks/usePriceLists";
import UserMenu from "@/components/layout/UserMenu";
import ProfileModal from "@/components/profile/ProfileModal";
import type { EffectivePriceItem } from "@/lib/api/priceLists";

function fmt(n: number) {
  return "$ " + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

function PriceCell({
  value,
  hasOverride,
  onSave,
}: {
  value: number;
  hasOverride: boolean;
  onSave: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const n = Number(draft);
    if (!isNaN(n) && n >= 0 && n !== value) {
      onSave(n);
    } else {
      setDraft(String(value));
    }
  }

  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#94a3b8]">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className={`h-[36px] w-[130px] rounded-[8px] border pl-6 pr-2 text-[12px] font-medium text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#d9622c]/20 ${
          hasOverride
            ? "border-[#d9622c] bg-[#fbeee1]"
            : "border-[#dde4ee] bg-white focus:border-[#d9622c]"
        }`}
      />
    </div>
  );
}

export default function PriceListsPage() {
  const { data: session, status } = useSession();
  const role = session?.role;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const userId = session?.userId;
  const router = useRouter();

  const { data: users = [] } = useUsers();
  const operators = useMemo(
    () => users.filter((u) => u.role === "OPERATOR" && u.is_active),
    [users]
  );

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!selectedUserId && operators.length > 0) {
      setSelectedUserId(operators[0].id);
    }
  }, [operators, selectedUserId]);

  const { data: items = [], isLoading } = useEffectivePriceList(selectedUserId || undefined);
  const setOverride = useSetPriceOverride();
  const deleteOverride = useDeletePriceOverride();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.product_name.toLowerCase().includes(q) || i.brand_name.toLowerCase().includes(q)
    );
  }, [items, search]);

  useEffect(() => {
    if (status === "authenticated" && role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [status, role, router]);

  if (status === "loading") return null;
  if (status === "authenticated" && role !== "ADMIN") return null;

  function handleReset(item: EffectivePriceItem) {
    if (!selectedUserId) return;
    deleteOverride.mutate({ userId: selectedUserId, productId: item.product_id });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      <header className="flex items-center justify-between bg-[#d9622c] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-bold text-[17px] text-white">Listas de Precios</h1>
        </div>
        <UserMenu
          name={name}
          email={email}
          role={role}
          onOpenProfile={() => setProfileOpen(true)}
          variant="dark"
        />
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4eaf2] bg-white px-5 py-3">
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="h-[38px] rounded-[8px] border border-[#dde4ee] bg-white px-3 text-[12px] font-medium text-[#0f172a] focus:border-[#d9622c] focus:outline-none"
        >
          {operators.length === 0 && <option value="">Sin operadores</option>}
          {operators.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>

        <div className="relative flex-1 sm:max-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o marca..."
            className="h-[38px] w-full rounded-[8px] border border-[#dde4ee] bg-white pl-9 pr-3 text-[12px] focus:border-[#d9622c] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 p-5">
        <div className="mb-3 text-[12px] text-[#94a3b8]">
          El precio de venta sugerido y el costo se pueden personalizar por operador. Lo que no
          se personaliza queda con el valor por defecto del catálogo.
        </div>

        <div className="overflow-x-auto rounded-[14px] border border-[#e8ecf2] bg-white">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#e8ecf2] bg-[#f8fafc] text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3">Costo (catálogo)</th>
                <th className="px-4 py-3">Precio venta (catálogo)</th>
                <th className="px-4 py-3">Costo del operador</th>
                <th className="px-4 py-3">Precio sugerido del operador</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[#94a3b8]">
                    Cargando...
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[#94a3b8]">
                    No hay productos.
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.product_id} className="border-b border-[#f1f5f9] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#0f172a]">{item.product_name}</td>
                  <td className="px-4 py-3 text-[#64748b]">{item.brand_name}</td>
                  <td className="px-4 py-3 text-[#64748b]">{fmt(item.catalog_purchase_price)}</td>
                  <td className="px-4 py-3 text-[#64748b]">{fmt(item.catalog_sale_price)}</td>
                  <td className="px-4 py-3">
                    <PriceCell
                      value={item.effective_purchase_price}
                      hasOverride={item.has_purchase_override}
                      onSave={(n) =>
                        selectedUserId &&
                        setOverride.mutate({
                          userId: selectedUserId,
                          data: { product_id: item.product_id, purchase_price: n },
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <PriceCell
                      value={item.effective_sale_price}
                      hasOverride={item.has_sale_override}
                      onSave={(n) =>
                        selectedUserId &&
                        setOverride.mutate({
                          userId: selectedUserId,
                          data: { product_id: item.product_id, sale_price: n },
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    {(item.has_purchase_override || item.has_sale_override) && (
                      <button
                        onClick={() => handleReset(item)}
                        title="Restablecer al valor de catálogo"
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
