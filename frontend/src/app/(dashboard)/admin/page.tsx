"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldOff,
  ChevronRight,
  DollarSign,
  Activity,
  Target,
  Users as UsersIcon,
  ShieldAlert,
  Package,
} from "lucide-react";
import { useQuoteStats } from "@/hooks/useQuotes";
import { useUsers } from "@/hooks/useUsers";
import { useWarranties } from "@/hooks/useWarranties";
import { useProducts, useCategories, useBrands } from "@/hooks/useProducts";
import UserMenu from "@/components/layout/UserMenu";

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

const WARRANTY_EXPIRY_WARNING_DAYS = 60;

// ── Componentes UI ────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  loading?: boolean;
}

function KpiCard({ label, value, sub, icon, loading }: KpiCardProps) {
  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#fdf6e3] text-[#7a5800]">
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded-[6px] bg-[#f1f5f9]" />
      ) : (
        <p className="text-[28px] font-bold leading-none text-[#0f172a]">{value}</p>
      )}
      {sub && <p className="mt-2 text-[11px] text-[#94a3b8]">{sub}</p>}
    </div>
  );
}

function TeamBreakdown({
  perUser,
  users,
}: {
  perUser: {
    user_id: string;
    total_quotes: number;
    quotes_this_month: number;
    conversion_rate: number;
    total_revenue: number;
  }[];
  users: { id: string; full_name: string; email: string }[];
}) {
  if (perUser.length === 0) {
    return (
      <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-8 text-center text-[13px] text-[#94a3b8]">
        Sin actividad de ventas todavía.
      </div>
    );
  }
  const sorted = [...perUser].sort((a, b) => b.total_revenue - a.total_revenue);
  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white">
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <p className="text-[13px] font-semibold text-[#0f172a]">Ranking por operador</p>
      </div>
      <div className="divide-y divide-[#f8fafc]">
        {sorted.map((stat) => {
          const user = users.find((u) => u.id === stat.user_id);
          if (!user) return null;
          const maxRevenue = sorted[0]?.total_revenue || 1;
          return (
            <div key={stat.user_id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0c520] text-[11px] font-bold text-[#7a5800]">
                {user.full_name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-[13px] font-semibold text-[#0f172a]">
                    {user.full_name}
                  </p>
                  <div className="flex shrink-0 items-center gap-4 pl-4 text-[12px] text-[#475569]">
                    <span>{stat.conversion_rate}% conv.</span>
                    <span>{stat.total_quotes} presupuestos</span>
                    <span className="font-semibold text-[#0f172a]">
                      {money(stat.total_revenue)}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
                  <div
                    className="h-full rounded-full bg-[#f0c520]"
                    style={{ width: `${(stat.total_revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPanelPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const role = session?.role;

  useEffect(() => {
    if (status === "authenticated" && role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [status, role, router]);

  const { data: quoteStats, isLoading: loadingStats } = useQuoteStats();
  const { data: users = [], isLoading: loadingUsers } = useUsers();
  const { data: warranties = [], isLoading: loadingWarranties } = useWarranties();
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  const userSummary = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    return { total: users.length, active, admins, operators: users.length - admins };
  }, [users]);

  const warrantySummary = useMemo(() => {
    const now = new Date();
    const warningLimit = new Date(now.getTime() + WARRANTY_EXPIRY_WARNING_DAYS * 86_400_000);
    const valid = warranties.filter((w) => w.is_valid);
    const expired = warranties.filter((w) => !w.is_valid);
    const expiringSoon = valid.filter((w) => new Date(w.expires_at) <= warningLimit);
    return {
      total: warranties.length,
      valid: valid.length,
      expired: expired.length,
      expiringSoon: expiringSoon.length,
    };
  }, [warranties]);

  if (status === "loading") return null;
  if (status === "authenticated" && role !== "ADMIN") return null;

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <header className="flex items-center justify-between border-b border-[#e4eaf2] bg-white px-5 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white">
              <Image src="/logo.png" alt="Intermedios" width={26} height={26} className="object-contain" />
            </div>
            <span className="hidden text-[15px] font-semibold text-[#1a1a2e] sm:inline">
              Intermedios
            </span>
          </Link>
          <span className="text-[#cbd5e1]">/</span>
          <span className="text-[14px] font-semibold text-[#0f172a]">Panel Admin</span>
        </div>
        <UserMenu name={name} email={email} role={role} onOpenProfile={() => {}} />
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-[13px] text-[#64748b] hover:text-[#0f172a]"
          >
            <ArrowLeft size={14} />
            Volver
          </Link>
          <span className="text-[#e2e8f0]">|</span>
          <div>
            <h1 className="text-[20px] font-bold text-[#0f172a]">Panel de administración</h1>
            <p className="text-[12px] text-[#94a3b8]">
              Vista consolidada de toda la plataforma — todos los operadores
            </p>
          </div>
        </div>

        {/* ── Ventas de plataforma ──────────────────────────────────────────── */}
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          Ventas
        </p>
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Facturado este mes"
            value={loadingStats ? "—" : money(quoteStats?.revenue_this_month ?? 0)}
            sub="toda la plataforma"
            icon={<DollarSign size={16} />}
            loading={loadingStats}
          />
          <KpiCard
            label="Facturado histórico"
            value={loadingStats ? "—" : money(quoteStats?.total_revenue ?? 0)}
            icon={<Activity size={16} />}
            loading={loadingStats}
          />
          <KpiCard
            label="Conversión promedio"
            value={loadingStats ? "—" : `${quoteStats?.conversion_rate ?? 0}%`}
            icon={<Target size={16} />}
            loading={loadingStats}
          />
          <KpiCard
            label="Presupuestos del mes"
            value={loadingStats ? "—" : quoteStats?.quotes_this_month ?? 0}
            sub={`${quoteStats?.total_quotes ?? 0} histórico`}
            icon={<ChevronRight size={16} />}
            loading={loadingStats}
          />
        </div>

        <div className="mb-8">
          <TeamBreakdown perUser={quoteStats?.per_user ?? []} users={users} />
        </div>

        {/* ── Usuarios ──────────────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            Usuarios
          </p>
          <Link
            href="/users"
            data-tour="admin-users-link"
            className="flex items-center gap-1 text-[12px] font-medium text-[#d9622c] hover:text-[#b74e1e]"
          >
            Gestionar usuarios <ChevronRight size={13} />
          </Link>
        </div>
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total usuarios"
            value={loadingUsers ? "—" : userSummary.total}
            icon={<UsersIcon size={16} />}
            loading={loadingUsers}
          />
          <KpiCard
            label="Activos"
            value={loadingUsers ? "—" : userSummary.active}
            sub={`${userSummary.total - userSummary.active} inactivos`}
            icon={<ShieldCheck size={16} />}
            loading={loadingUsers}
          />
          <KpiCard
            label="Administradores"
            value={loadingUsers ? "—" : userSummary.admins}
            icon={<ShieldOff size={16} />}
            loading={loadingUsers}
          />
          <KpiCard
            label="Instaladores"
            value={loadingUsers ? "—" : userSummary.operators}
            icon={<UsersIcon size={16} />}
            loading={loadingUsers}
          />
        </div>

        {/* ── Garantías ─────────────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            Garantías
          </p>
          <Link
            href="/orders/warranties"
            className="flex items-center gap-1 text-[12px] font-medium text-[#d9622c] hover:text-[#b74e1e]"
          >
            Ver garantías <ChevronRight size={13} />
          </Link>
        </div>
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total emitidas"
            value={loadingWarranties ? "—" : warrantySummary.total}
            icon={<ShieldCheck size={16} />}
            loading={loadingWarranties}
          />
          <KpiCard
            label="Vigentes"
            value={loadingWarranties ? "—" : warrantySummary.valid}
            icon={<ShieldCheck size={16} />}
            loading={loadingWarranties}
          />
          <KpiCard
            label="Vencidas"
            value={loadingWarranties ? "—" : warrantySummary.expired}
            icon={<ShieldOff size={16} />}
            loading={loadingWarranties}
          />
          <KpiCard
            label="Por vencer"
            value={loadingWarranties ? "—" : warrantySummary.expiringSoon}
            sub={`próximos ${WARRANTY_EXPIRY_WARNING_DAYS} días`}
            icon={<ShieldAlert size={16} />}
            loading={loadingWarranties}
          />
        </div>

        {/* ── Catálogo ──────────────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            Catálogo
          </p>
          <Link
            href="/price-lists"
            data-tour="admin-pricelists-link"
            className="flex items-center gap-1 text-[12px] font-medium text-[#d9622c] hover:text-[#b74e1e]"
          >
            Listas de precios <ChevronRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Productos activos"
            value={loadingProducts ? "—" : products.filter((p) => p.is_active).length}
            sub={`${products.length} en total`}
            icon={<Package size={16} />}
            loading={loadingProducts}
          />
          <KpiCard label="Marcas" value={brands.length} icon={<Package size={16} />} />
          <KpiCard label="Categorías" value={categories.length} icon={<Package size={16} />} />
        </div>
      </main>
    </div>
  );
}
