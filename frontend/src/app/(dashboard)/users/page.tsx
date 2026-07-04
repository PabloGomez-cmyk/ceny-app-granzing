"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
} from "lucide-react";
import { useUsers, useDeleteUser, useUpdateUser } from "@/hooks/useUsers";
import { useQuoteStats } from "@/hooks/useQuotes";
import UserFormModal, { type ModalMode } from "@/components/users/UserFormModal";
import UserMenu from "@/components/layout/UserMenu";
import ProfileModal from "@/components/profile/ProfileModal";
import type { User } from "@/lib/api/users";
import type { UserQuoteStat } from "@/lib/api/quotes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const AVATAR_PALETTE = [
  "#0f6e50", "#2563eb", "#7c3aed", "#dc2626", "#d97706",
  "#0891b2", "#059669", "#9333ea", "#be185d", "#1d4ed8",
];

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  const fontSize = size <= 32 ? 11 : 13;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize }}
    >
      {getInitials(name)}
    </div>
  );
}

function rolLabel(role: string) {
  return role === "ADMIN" ? "Admin" : "Instalador";
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  sub,
  accent,
}: {
  value: string | number;
  label: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[12px] border bg-white p-4 ${
        accent ? "border-l-4 border-l-amber-400 border-[#e8ecf2]" : "border-[#e8ecf2]"
      }`}
    >
      <p
        className={`font-bold text-[28px] leading-none ${
          accent ? "text-amber-500" : "text-[#0f172a]"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#374151]">{label}</p>
      <p className="text-[11px] text-[#94a3b8]">{sub}</p>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// ── User row (desktop) ────────────────────────────────────────────────────────

function UserRow({
  user,
  stat,
  selected,
  onSelect,
  onEdit,
}: {
  user: User;
  stat: UserQuoteStat | undefined;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafb] ${
        selected ? "bg-[#f0faf6]" : ""
      }`}
    >
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} size={36} />
          <div>
            <p className="text-[13px] font-semibold text-[#0f172a]">{user.full_name}</p>
            <p className="text-[11px] text-[#94a3b8]">{rolLabel(user.role)}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-[13px] text-[#475569]">{user.email}</td>
      <td className="px-3 py-3 text-[13px] text-[#94a3b8]">—</td>
      <td className="px-3 py-3 text-[13px] text-[#0f172a] font-medium">
        {stat ? stat.total_quotes : "—"}
      </td>
      <td className="px-3 py-3 text-[13px] text-[#0f172a] font-medium">
        {stat ? `${stat.conversion_rate}%` : "—"}
      </td>
      <td className="px-3 py-3 text-[13px] text-[#94a3b8]">—</td>
      <td className="px-3 py-3">
        <StatusBadge active={user.is_active} />
      </td>
      <td
        className="py-3 pl-3 pr-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="rounded-[8px] border border-[#e2e6f0] px-3 py-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:bg-[#f1f5f9]"
        >
          Editar
        </button>
      </td>
    </tr>
  );
}

// ── User card (mobile) ────────────────────────────────────────────────────────

function UserCard({
  user,
  stat,
  onEdit,
}: {
  user: User;
  stat: UserQuoteStat | undefined;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-[12px] border border-[#e8ecf2] bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} size={40} />
          <div>
            <p className="text-[13px] font-semibold text-[#0f172a]">{user.full_name}</p>
            <p className="text-[11px] text-[#94a3b8]">
              {rolLabel(user.role)}
            </p>
            <p className="text-[11px] text-[#94a3b8]">{user.email}</p>
          </div>
        </div>
        <StatusBadge active={user.is_active} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#f1f5f9] pt-3">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[12px] font-bold text-[#0f172a]">
              {stat ? stat.total_quotes : "—"}
            </p>
            <p className="text-[10px] text-[#94a3b8]">Presup.</p>
          </div>
          <div className="text-center">
            <p className="text-[12px] font-bold text-[#0f172a]">
              {stat ? `${stat.conversion_rate}%` : "—"}
            </p>
            <p className="text-[10px] text-[#94a3b8]">Conv.</p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="rounded-[8px] border border-[#e2e6f0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f1f5f9]"
        >
          Editar
        </button>
      </div>
    </div>
  );
}

// ── Detail panel (desktop) ────────────────────────────────────────────────────

function UserDetailPanel({
  user,
  stat,
  onEdit,
  onResetPassword,
  onToggleActive,
  isToggling,
}: {
  user: User;
  stat: UserQuoteStat | undefined;
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleActive: () => void;
  isToggling: boolean;
}) {
  return (
    <div className="border-t border-[#e8ecf2] bg-white px-6 py-4">
      <p className="mb-3 text-[12px] font-semibold text-[#94a3b8]">
        Detalle de usuario — {user.full_name}
      </p>
      <div className="flex flex-wrap items-center gap-8">
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} size={44} />
          <div>
            <p className="text-[14px] font-bold text-[#0f172a]">{user.full_name}</p>
            <p className="text-[12px] text-[#94a3b8]">{rolLabel(user.role)}</p>
            <p className="text-[12px] text-[#94a3b8]">{user.email}</p>
          </div>
        </div>

        <Metric label="Presup. mes" value={stat ? String(stat.quotes_this_month) : "—"} />
        <Metric label="Total presup." value={stat ? String(stat.total_quotes) : "—"} />
        <Metric label="Conversión" value={stat ? `${stat.conversion_rate}%` : "—"} />
        <Metric label="Lista precios" value="—" />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#0f6e50] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0a5a40]"
        >
          <Pencil size={13} />
          Editar usuario
        </button>
        <button
          onClick={onResetPassword}
          className="flex items-center gap-1.5 rounded-[10px] border border-[#e2e6f0] px-4 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#f1f5f9]"
        >
          <KeyRound size={13} />
          Reset password
        </button>
        <button
          onClick={onToggleActive}
          disabled={isToggling}
          className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[12px] font-medium disabled:opacity-60 ${
            user.is_active
              ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {user.is_active ? (
            <><UserX size={13} /> Desactivar</>
          ) : (
            <><UserCheck size={13} /> Reactivar</>
          )}
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[18px] font-bold text-[#0f172a]">{value}</p>
      <p className="text-[11px] text-[#94a3b8]">{label}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FilterTab = "active" | "all";

export default function UsersPage() {
  const { data: session, status } = useSession();
  const role = session?.role;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const userId = session?.userId;
  const router = useRouter();

  // Todos los hooks deben ir ANTES de cualquier return condicional
  const { data: users = [], isLoading, error } = useUsers();
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();
  const { data: quoteStats } = useQuoteStats();

  const [filter, setFilter] = useState<FilterTab>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: ModalMode; user?: User } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchFilter = filter === "all" || u.is_active;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [users, filter, search]);

  // Protección de ruta: solo ADMIN
  useEffect(() => {
    if (status === "authenticated" && role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [status, role, router]);

  if (status === "loading") return null;
  if (status === "authenticated" && role !== "ADMIN") return null;

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;
  const activeCount = users.filter((u) => u.is_active).length;

  function handleToggleActive(user: User) {
    if (user.is_active) {
      deleteUser(user.id);
    } else {
      updateUser({ id: user.id, data: { is_active: true } });
    }
    setSelectedId(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* ── Header verde ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between bg-[#0f6e50] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-bold text-[17px] text-white">Usuarios</h1>
        </div>
        <UserMenu
          name={name}
          email={email}
          role={role}
          onOpenProfile={() => setProfileOpen(true)}
          variant="dark"
        />
      </header>

      {/* ── Barra de acciones ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4eaf2] bg-white px-5 py-3">
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#0f6e50] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0a5a40]"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Nuevo usuario</span>
          <span className="sm:hidden">Nuevo</span>
        </button>

        <div className="relative flex-1 sm:max-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario..."
            className="h-[36px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] pl-8 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20"
          />
        </div>

        <div className="flex overflow-hidden rounded-[10px] border border-[#dde4ee] bg-[#f8fafc]">
          {(["active", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 text-[12px] font-medium transition-colors ${
                filter === tab
                  ? "bg-[#0f6e50] text-white"
                  : "text-[#475569] hover:bg-[#f1f5f9]"
              }`}
            >
              {tab === "active" ? "Activos" : "Todos"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[12px] text-[#94a3b8]">
          {filtered.length} usuario{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 p-5">
        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            value={activeCount}
            label="Usuarios activos"
            sub={`de ${users.length} registrados`}
          />
          <StatCard
            value={quoteStats ? quoteStats.quotes_this_month : "—"}
            label="Presupuestos mes"
            sub={quoteStats ? `${quoteStats.total_quotes} en total` : "cargando..."}
          />
          <StatCard
            value={quoteStats ? `${quoteStats.conversion_rate}%` : "—"}
            label="Conv. promedio"
            sub="aceptados / enviados"
          />
          <StatCard value="—" label="Región top" sub="próximamente" accent />
        </div>

        {/* ── Loading / Error ─────────────────────────────────────────────── */}
        {isLoading && (
          <p className="py-12 text-center text-[13px] text-[#94a3b8]">
            Cargando usuarios...
          </p>
        )}
        {error && (
          <p className="py-12 text-center text-[13px] text-red-500">
            {error.message}
          </p>
        )}

        {/* ── Tabla desktop ───────────────────────────────────────────────── */}
        {!isLoading && !error && (
          <div className="hidden overflow-hidden rounded-[12px] border border-[#e8ecf2] bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                  {["Usuario", "Email", "Región", "Presupuestos", "Conversión", "Lista precios", "Estado", "Acciones"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] first:pl-5 last:pr-5"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[13px] text-[#94a3b8]">
                      Sin usuarios{filter === "active" ? " activos" : ""}.
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      stat={quoteStats?.per_user.find((s) => s.user_id === user.id)}
                      selected={selectedId === user.id}
                      onSelect={() =>
                        setSelectedId((prev) => (prev === user.id ? null : user.id))
                      }
                      onEdit={() => setModal({ mode: "edit", user })}
                    />
                  ))
                )}
              </tbody>
            </table>

            {/* Detail panel */}
            {selectedUser && (
              <UserDetailPanel
                user={selectedUser}
                stat={quoteStats?.per_user.find((s) => s.user_id === selectedUser.id)}
                onEdit={() => setModal({ mode: "edit", user: selectedUser })}
                onResetPassword={() =>
                  setModal({ mode: "reset-password", user: selectedUser })
                }
                onToggleActive={() => handleToggleActive(selectedUser)}
                isToggling={isDeleting || isUpdating}
              />
            )}
          </div>
        )}

        {/* ── Cards mobile ────────────────────────────────────────────────── */}
        {!isLoading && !error && (
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-[#94a3b8]">
                Sin usuarios{filter === "active" ? " activos" : ""}.
              </p>
            ) : (
              filtered.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  stat={quoteStats?.per_user.find((s) => s.user_id === user.id)}
                  onEdit={() => setModal({ mode: "edit", user })}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Modal usuarios ──────────────────────────────────────────────────── */}
      {modal && (
        <UserFormModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Modal perfil ────────────────────────────────────────────────────── */}
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
