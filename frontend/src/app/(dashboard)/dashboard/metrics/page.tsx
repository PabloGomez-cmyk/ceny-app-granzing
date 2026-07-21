"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Send,
  CheckCircle,
  Receipt,
  XCircle,
  Users,
  Package,
  Clock,
  DollarSign,
  Target,
  Activity,
  ChevronRight,
  Building2,
  Car,
  LayoutGrid,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useQuotes } from "@/hooks/useQuotes";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts, useCategories } from "@/hooks/useProducts";
import UserMenu from "@/components/layout/UserMenu";
import type { Quote } from "@/lib/api/quotes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function moneyFull(n: number) {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isLastMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth();
}

function conversionRate(quotes: Quote[]) {
  const nonCancelled = quotes.filter((q) => q.status !== "CANCELLED");
  const converted = nonCancelled.filter(
    (q) => q.status === "ACCEPTED" || q.status === "INVOICED" || q.status === "COMPLETED"
  );
  return nonCancelled.length > 0
    ? Math.round((converted.length / nonCancelled.length) * 1000) / 10
    : 0;
}

function sumTotal(quotes: Quote[]) {
  return quotes.reduce((acc, q) => acc + Number(q.totals.total), 0);
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  ACCEPTED: "Aceptado",
  INVOICED: "Facturado",
  COMPLETED: "Terminado",
  CANCELLED: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  INVOICED: "bg-violet-50 text-violet-700",
  COMPLETED: "bg-teal-50 text-teal-700",
  CANCELLED: "bg-red-50 text-red-500",
};

// Genera últimos N meses (inclusive el actual)
function lastNMonths(n: number) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return months;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

// ── Componentes UI ────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: number;
  accent?: boolean;
  loading?: boolean;
}

function KpiCard({ label, value, sub, icon, trend, accent, loading }: KpiCardProps) {
  return (
    <div className={`rounded-[14px] border bg-white p-5 ${accent ? "border-l-4 border-l-[#d9622c] border-[#e8ecf2]" : "border-[#e8ecf2]"}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#fbeee1] text-[#d9622c]">
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded-[6px] bg-[#f1f5f9]" />
      ) : (
        <p className={`text-[28px] font-bold leading-none ${accent ? "text-[#d9622c]" : "text-[#0f172a]"}`}>
          {value}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {trend !== undefined && !loading && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${
            trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-500" : "text-[#94a3b8]"
          }`}>
            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {trend > 0 ? "+" : ""}{trend}% vs mes ant.
          </span>
        )}
        {sub && <span className="text-[11px] text-[#94a3b8]">{sub}</span>}
      </div>
    </div>
  );
}

function PipelineBar({ quotes }: { quotes: Quote[] }) {
  const statuses = ["DRAFT", "SENT", "ACCEPTED", "INVOICED", "COMPLETED", "CANCELLED"] as const;
  const counts = statuses.map((s) => ({ status: s, count: quotes.filter((q) => q.status === s).length }));
  const total = quotes.length || 1;
  const icons = {
    DRAFT: <FileText size={13} />,
    SENT: <Send size={13} />,
    ACCEPTED: <CheckCircle size={13} />,
    INVOICED: <Receipt size={13} />,
    COMPLETED: <CheckCircle size={13} />,
    CANCELLED: <XCircle size={13} />,
  };
  const colors = {
    DRAFT: "bg-slate-400",
    SENT: "bg-blue-400",
    ACCEPTED: "bg-emerald-500",
    INVOICED: "bg-violet-500",
    COMPLETED: "bg-teal-500",
    CANCELLED: "bg-red-400",
  };

  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
        Estado del pipeline
      </p>
      <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
        {counts.filter((c) => c.count > 0).map(({ status, count }) => (
          <div
            key={status}
            className={`${colors[status]} transition-all`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${STATUS_LABEL[status]}: ${count}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map(({ status, count }) => (
          <div key={status} className="flex items-center gap-2">
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[status]}`}>
              {icons[status as keyof typeof icons]}
              {count}
            </span>
            <span className="text-[11px] text-[#64748b]">{STATUS_LABEL[status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Gráfico ventas mensuales ──────────────────────────────────────────────────

function MonthlyChart({ quotes }: { quotes: Quote[] }) {
  const data = useMemo(() => {
    const months = lastNMonths(6);
    const closed = quotes.filter(
      (q) => q.status === "ACCEPTED" || q.status === "INVOICED" || q.status === "COMPLETED"
    );

    return months.map(({ year, month }) => {
      const key = monthKey(year, month);
      const monthQuotes = closed.filter((q) => {
        const d = new Date(q.created_at);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      return {
        name: monthLabel(year, month),
        key,
        total: Math.round(sumTotal(monthQuotes)),
        count: monthQuotes.length,
      };
    });
  }, [quotes]);

  const hasData = data.some((d) => d.total > 0);

  const formatYAxis = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v}`;
  };

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: { count: number } }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-3 shadow-lg">
        <p className="mb-1 text-[12px] font-semibold capitalize text-[#0f172a]">{label}</p>
        <p className="text-[13px] font-bold text-[#d9622c]">{moneyFull(payload[0].value)}</p>
        <p className="text-[11px] text-[#94a3b8]">{payload[0].payload.count} orden{payload[0].payload.count !== 1 ? "es" : ""}</p>
      </div>
    );
  };

  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white p-5">
      <p className="mb-1 text-[14px] font-bold text-[#d9622c]">Ventas mensuales</p>
      <p className="mb-5 text-[12px] text-[#94a3b8]">Presupuestos aceptados + facturados + terminados</p>
      {!hasData ? (
        <div className="flex h-[200px] items-center justify-center text-[13px] text-[#94a3b8]">
          Sin datos de ventas aún
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#d9622c"
              strokeWidth={2.5}
              dot={{ fill: "#d9622c", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#d9622c" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Tabla ranking genérica ────────────────────────────────────────────────────

interface RankRow {
  id: string;
  name: string;
  revenue: number;
  count: number;
  badge?: string;
}

function RankTable({
  title,
  rows,
  emptyMsg = "Sin datos",
  colorBadge,
}: {
  title: string;
  rows: RankRow[];
  emptyMsg?: string;
  colorBadge?: boolean;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white">
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <p className="text-[13px] font-semibold text-[#0f172a]">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[#94a3b8]">{emptyMsg}</p>
      ) : (
        <div className="divide-y divide-[#f8fafc]">
          {rows.map((row, i) => (
            <div key={row.id} className="flex items-center gap-3 px-5 py-3">
              <span className="w-5 shrink-0 text-center text-[13px]">
                {i < 3 ? medals[i] : <span className="text-[11px] font-bold text-[#94a3b8]">{i + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-[#0f172a]">{row.name}</p>
                  {colorBadge && row.badge && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: row.badge }}
                    />
                  )}
                </div>
                <p className="text-[11px] text-[#94a3b8]">{row.count} orden{row.count !== 1 ? "es" : ""}</p>
              </div>
              <span className="shrink-0 text-[13px] font-bold text-[#0f172a]">
                {money(row.revenue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabla de presupuestos (recientes) ─────────────────────────────────────────

function QuoteTable({
  title,
  quotes,
  statuses,
}: {
  title: string;
  quotes: Quote[];
  statuses: string[];
}) {
  const filtered = [...quotes]
    .filter((q) => statuses.includes(q.status))
    .sort((a, b) => Number(b.totals.total) - Number(a.totals.total))
    .slice(0, 6);

  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
        <p className="text-[13px] font-semibold text-[#0f172a]">{title}</p>
        <Link href="/orders" className="flex items-center gap-1 text-[12px] font-medium text-[#d9622c] hover:text-[#b74e1e]">
          Ver todas <ChevronRight size={13} />
        </Link>
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[#94a3b8]">Sin órdenes en este estado.</p>
      ) : (
        <div className="divide-y divide-[#f8fafc]">
          {filtered.map((q) => {
            const snap = q.customer_snapshot as Record<string, string> | null;
            return (
              <Link
                key={q.id}
                href={`/orders/${q.id}`}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#f8fafb]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#f0f4f8] text-[11px] font-bold text-[#475569]">
                    {q.quote_number}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0f172a]">{snap?.name ?? "Sin cliente"}</p>
                    <p className="text-[11px] text-[#94a3b8]">
                      {new Date(q.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                  <span className="text-[13px] font-bold text-[#0f172a]">
                    {moneyFull(Number(q.totals.total))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentOrders({ quotes }: { quotes: Quote[] }) {
  const recent = [...quotes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="rounded-[14px] border border-[#e8ecf2] bg-white">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
        <p className="text-[13px] font-semibold text-[#0f172a]">Últimas órdenes</p>
        <Link href="/orders" className="flex items-center gap-1 text-[12px] font-medium text-[#d9622c] hover:text-[#b74e1e]">
          Ver todas <ChevronRight size={13} />
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[#94a3b8]">Sin órdenes aún.</p>
      ) : (
        <div className="divide-y divide-[#f8fafc]">
          {recent.map((q) => {
            const snap = q.customer_snapshot as Record<string, string> | null;
            return (
              <Link
                key={q.id}
                href={`/orders/${q.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[#f8fafb]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#f0f4f8] text-[11px] font-bold text-[#475569]">
                    {q.quote_number}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0f172a]">{snap?.name ?? "Sin cliente"}</p>
                    <p className="text-[11px] text-[#94a3b8]">
                      {new Date(q.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                  <span className="text-[13px] font-bold text-[#0f172a]">
                    {moneyFull(Number(q.totals.total))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MetricsDashboardPage() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const role = session?.role;

  const { data: allQuotes = [], isLoading: loadingQuotes } = useQuotes();
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: categories = [] } = useCategories();

  const [saleTypeFilter, setSaleTypeFilter] = useState<"ALL" | "ARCHITECTURE" | "AUTOMOTIVE">("ALL");
  const quotes = useMemo(
    () =>
      saleTypeFilter === "ALL"
        ? allQuotes
        : allQuotes.filter((q) => q.sale_type === saleTypeFilter),
    [allQuotes, saleTypeFilter]
  );
  const architectureCount = useMemo(
    () => allQuotes.filter((q) => q.sale_type === "ARCHITECTURE").length,
    [allQuotes]
  );
  const automotiveCount = useMemo(
    () => allQuotes.filter((q) => q.sale_type === "AUTOMOTIVE").length,
    [allQuotes]
  );

  const now = new Date();
  const monthName = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  // ── KPIs base ──────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const thisMonth = quotes.filter((q) => isThisMonth(q.created_at));
    const lastMonth = quotes.filter((q) => isLastMonth(q.created_at));

    const invoicedThisMonth = thisMonth.filter((q) => q.status === "ACCEPTED" || q.status === "INVOICED" || q.status === "COMPLETED");
    const invoicedLastMonth = lastMonth.filter((q) => q.status === "ACCEPTED" || q.status === "INVOICED" || q.status === "COMPLETED");
    const invoicedTotal = sumTotal(invoicedThisMonth);
    const invoicedLastTotal = sumTotal(invoicedLastMonth);
    const invoicedTrend = invoicedLastTotal > 0
      ? Math.round(((invoicedTotal - invoicedLastTotal) / invoicedLastTotal) * 100)
      : null;

    const pipeline = quotes.filter((q) => q.status === "DRAFT" || q.status === "SENT");
    const pipelineTotal = sumTotal(pipeline);

    const conversion = conversionRate(quotes);
    const conversionLast = conversionRate(lastMonth);
    const conversionTrend = Math.round((conversion - conversionLast) * 10) / 10;

    const closedAll = quotes.filter((q) => q.status === "ACCEPTED" || q.status === "INVOICED" || q.status === "COMPLETED");
    const avgTicket = closedAll.length > 0 ? sumTotal(closedAll) / closedAll.length : 0;

    const quotesThisMonth = thisMonth.length;
    const quotesLastMonth = lastMonth.length;
    const quotesTrend = quotesLastMonth > 0
      ? Math.round(((quotesThisMonth - quotesLastMonth) / quotesLastMonth) * 100)
      : null;

    const newCustomers = customers.filter((c) => isThisMonth(c.created_at ?? "")).length;
    const pendingResponse = quotes.filter((q) => q.status === "SENT").length;

    return {
      invoicedTotal, invoicedTrend, pipelineTotal, pipelineCount: pipeline.length,
      conversion, conversionTrend, avgTicket,
      quotesThisMonth, quotesTrend, newCustomers,
      pendingResponse, totalCustomers: customers.length,
      totalProducts: products.filter((p) => p.is_active).length,
    };
  }, [quotes, customers, products]);

  // ── Rankings ───────────────────────────────────────────────────────────────

  const rankings = useMemo(() => {
    const closed = quotes.filter((q) => q.status === "ACCEPTED" || q.status === "INVOICED" || q.status === "COMPLETED");

    // Mapa product_id → { name, category_id, brand_color }
    const productMap = new Map(products.map((p) => [p.id, p]));
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    // Por producto
    const byProduct: Record<string, { name: string; badge?: string; revenue: number; count: number }> = {};
    const byCategory: Record<string, { name: string; revenue: number; count: number }> = {};
    const byClient: Record<string, { name: string; revenue: number; count: number }> = {};

    for (const q of closed) {
      // Cliente
      const snap = q.customer_snapshot as Record<string, string> | null;
      const clientKey = snap?.name ?? "Sin cliente";
      if (!byClient[clientKey]) byClient[clientKey] = { name: clientKey, revenue: 0, count: 0 };
      byClient[clientKey].revenue += Number(q.totals.total);
      byClient[clientKey].count += 1;

      // Líneas (producto + categoría)
      for (const line of q.lines) {
        const lsnap = line.product_snapshot as Record<string, string | number> | null;
        const prodName = String(lsnap?.name ?? "Producto desconocido");
        const prodData = productMap.get(line.product_id);
        const lineRevenue = Number(line.subtotal);

        // Producto
        const prodKey = line.product_id;
        if (!byProduct[prodKey]) {
          byProduct[prodKey] = {
            name: prodName,
            badge: prodData ? String(prodData.brand_id) : undefined,
            revenue: 0,
            count: 0,
          };
        }
        byProduct[prodKey].revenue += lineRevenue;
        byProduct[prodKey].count += 1;

        // Categoría
        if (prodData) {
          const catName = categoryMap.get(prodData.category_id) ?? "Sin categoría";
          if (!byCategory[prodData.category_id]) {
            byCategory[prodData.category_id] = { name: catName, revenue: 0, count: 0 };
          }
          byCategory[prodData.category_id].revenue += lineRevenue;
          byCategory[prodData.category_id].count += 1;
        }
      }
    }

    const toRows = (map: Record<string, { name: string; badge?: string; revenue: number; count: number }>): RankRow[] =>
      Object.entries(map)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    return {
      products: toRows(byProduct),
      categories: toRows(byCategory),
      clients: toRows(byClient),
    };
  }, [quotes, products, categories]);

  const loading = loadingQuotes || loadingCustomers || loadingProducts;

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Header */}
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
          <span className="text-[14px] font-semibold text-[#0f172a]">Dashboard</span>
        </div>
        <UserMenu name={name} email={email} role={role} onOpenProfile={() => {}} />
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-8">
        {/* Title */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-[13px] text-[#64748b] hover:text-[#0f172a]">
            <ArrowLeft size={14} />
            Volver
          </Link>
          <span className="text-[#e2e8f0]">|</span>
          <div>
            <h1 className="text-[20px] font-bold text-[#0f172a]">Resumen de actividad</h1>
            <p className="text-[12px] text-[#94a3b8] capitalize">{monthName}</p>
          </div>
        </div>

        {/* Filtro por tipo de venta */}
        <div className="mb-6 flex w-fit overflow-x-auto rounded-[10px] border border-[#dde4ee] bg-white p-1">
          {(
            [
              { key: "ALL", label: "Todos", icon: LayoutGrid, count: allQuotes.length },
              { key: "ARCHITECTURE", label: "Arquitectura", icon: Building2, count: architectureCount },
              { key: "AUTOMOTIVE", label: "Automotriz", icon: Car, count: automotiveCount },
            ] as const
          ).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setSaleTypeFilter(key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                saleTypeFilter === key
                  ? "bg-[#d9622c] text-white"
                  : "text-[#64748b] hover:bg-[#f1f5f9]"
              }`}
            >
              <Icon size={13} />
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${saleTypeFilter === key ? "bg-white/20" : "bg-[#f1f5f9] text-[#94a3b8]"}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Fila 1: KPIs financieros ─────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Facturado este mes"
            value={loading ? "—" : money(kpis.invoicedTotal)}
            sub={kpis.invoicedTrend === null ? "primer mes" : undefined}
            trend={kpis.invoicedTrend ?? undefined}
            icon={<DollarSign size={16} />}
            accent
            loading={loading}
          />
          <KpiCard
            label="Pipeline activo"
            value={loading ? "—" : money(kpis.pipelineTotal)}
            sub={loading ? undefined : `${kpis.pipelineCount} presupuesto${kpis.pipelineCount !== 1 ? "s" : ""} en curso`}
            icon={<Activity size={16} />}
            loading={loading}
          />
          <KpiCard
            label="Tasa de conversión"
            value={loading ? "—" : `${kpis.conversion}%`}
            trend={kpis.conversionTrend !== 0 ? kpis.conversionTrend : undefined}
            sub="cerrados / no cancelados"
            icon={<Target size={16} />}
            loading={loading}
          />
          <KpiCard
            label="Ticket promedio"
            value={loading ? "—" : money(kpis.avgTicket)}
            sub="presupuestos cerrados"
            icon={<TrendingUp size={16} />}
            loading={loading}
          />
        </div>

        {/* ── Fila 2: KPIs operativos ──────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label="Presupuestos del mes"
            value={loading ? "—" : kpis.quotesThisMonth}
            trend={kpis.quotesTrend ?? undefined}
            sub={kpis.quotesTrend === null ? "primer mes" : undefined}
            icon={<FileText size={16} />}
            loading={loading}
          />
          <KpiCard
            label="Esperando respuesta"
            value={loading ? "—" : kpis.pendingResponse}
            sub="estado Enviado"
            icon={<Clock size={16} />}
            loading={loading}
          />
          <KpiCard
            label="Clientes totales"
            value={loadingCustomers ? "—" : kpis.totalCustomers}
            sub={`${kpis.newCustomers} nuevos este mes`}
            icon={<Users size={16} />}
            loading={loadingCustomers}
          />
          <KpiCard
            label="Productos activos"
            value={loadingProducts ? "—" : kpis.totalProducts}
            sub="en catálogo"
            icon={<Package size={16} />}
            loading={loadingProducts}
          />
        </div>

        {/* ── Pipeline visual ──────────────────────────────────────────────── */}
        <div className="mb-5">
          <PipelineBar quotes={quotes} />
        </div>

        {/* ── Gráfico ventas mensuales ─────────────────────────────────────── */}
        <div className="mb-5">
          <MonthlyChart quotes={quotes} />
        </div>

        {/* ── Rankings: productos, categorías, clientes ─────────────────────── */}
        <div className="mb-5 grid gap-5 lg:grid-cols-3">
          <RankTable
            title="Mejores productos"
            rows={rankings.products}
            emptyMsg="Sin ventas cerradas aún"
          />
          <RankTable
            title="Mejores categorías"
            rows={rankings.categories}
            emptyMsg="Sin ventas cerradas aún"
          />
          <RankTable
            title="Mejores clientes"
            rows={rankings.clients}
            emptyMsg="Sin ventas cerradas aún"
          />
        </div>

        {/* ── Mejores cotizaciones vs mejores ventas ─────────────────────────── */}
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <QuoteTable
            title="Mejores cotizaciones activas"
            quotes={quotes}
            statuses={["DRAFT", "SENT"]}
          />
          <QuoteTable
            title="Mejores ventas cerradas"
            quotes={quotes}
            statuses={["ACCEPTED", "INVOICED", "COMPLETED"]}
          />
        </div>

        {/* ── Últimas órdenes ───────────────────────────────────────────────── */}
        <div className="mb-5">
          <RecentOrders quotes={quotes} />
        </div>
      </main>
    </div>
  );
}
