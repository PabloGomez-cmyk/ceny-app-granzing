"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import {
  BarChart2,
  Users,
  ShoppingCart,
  Crown,
  Settings2,
  Package,
} from "lucide-react";
import ProfileModal from "@/components/profile/ProfileModal";
import UserMenu from "@/components/layout/UserMenu";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

// ── Módulos ───────────────────────────────────────────────────────────────────

interface AppModule {
  name: string;
  href: string;
  icon: LucideIcon;
  bgFrom: string;
  bgTo: string;
  iconClass: string;
  roles: string[];
}

const MODULES: AppModule[] = [
  {
    name: "Dashboard",
    href: "/dashboard/metrics",
    icon: BarChart2,
    bgFrom: "#0fa078",
    bgTo: "#0c7e5f",
    iconClass: "text-white",
    roles: ["ADMIN", "OPERATOR"],
  },
  {
    name: "Clientes",
    href: "/customers",
    icon: Users,
    bgFrom: "#8ecfe0",
    bgTo: "#60b8d0",
    iconClass: "text-white",
    roles: ["ADMIN", "OPERATOR"],
  },
  {
    name: "Catálogo",
    href: "/products",
    icon: Package,
    bgFrom: "#86efac",
    bgTo: "#22c55e",
    iconClass: "text-white",
    roles: ["ADMIN", "OPERATOR"],
  },
  {
    name: "Ventas",
    href: "/orders",
    icon: ShoppingCart,
    bgFrom: "#dcea88",
    bgTo: "#c3d45e",
    iconClass: "text-[#4d6010]",
    roles: ["ADMIN", "OPERATOR"],
  },
  {
    name: "Panel Admin",
    href: "/admin",
    icon: Crown,
    bgFrom: "#f7de5a",
    bgTo: "#f0c520",
    iconClass: "text-[#7a5800]",
    roles: ["ADMIN"],
  },
  {
    name: "Configuración",
    href: "/settings",
    icon: Settings2,
    bgFrom: "#44c8b8",
    bgTo: "#28a898",
    iconClass: "text-white",
    roles: ["ADMIN", "OPERATOR"],
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? null;
  const role = session?.role;
  const userId = session?.userId;
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  const visible = MODULES.filter(
    (m) =>
      (!role || m.roles.includes(role)) &&
      m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Navbar */}
      <header className="flex items-center justify-between border-b border-[#e4eaf2] bg-white px-5 py-2.5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#0f6e50]">
            <span className="font-bold text-[15px] text-white">G</span>
          </div>
          <span className="hidden text-[15px] sm:inline">
            <span className="font-semibold text-[#1a1a2e]">Glazing</span>
            <span className="font-normal text-[#8898aa]"> Platform</span>
          </span>
          <span className="text-[15px] font-semibold text-[#1a1a2e] sm:hidden">
            Glazing
          </span>
        </Link>

        <UserMenu
          name={name}
          email={email}
          role={role}
          onOpenProfile={() => setProfileOpen(true)}
        />
      </header>

      {/* Content */}
      <main className="flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-[420px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aplicaciones..."
            className="w-full rounded-[10px] border border-[#dde4ee] bg-white px-4 py-2.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-sm focus:border-[#0f6e50] focus:outline-none focus:ring-2 focus:ring-[#0f6e50]/20"
          />
        </div>

        <div className="mt-10 grid grid-cols-3 gap-x-8 gap-y-8 sm:grid-cols-4 lg:grid-cols-5">
          {visible.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.name}
                href={mod.href as never}
                className="group flex flex-col items-center gap-2.5"
              >
                <div
                  className="flex h-[76px] w-[76px] items-center justify-center rounded-[20px] shadow-sm transition-all duration-150 group-hover:scale-105 group-hover:shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${mod.bgFrom} 0%, ${mod.bgTo} 100%)`,
                  }}
                >
                  <Icon size={32} className={mod.iconClass} strokeWidth={1.75} />
                </div>
                <span className="text-center text-[12px] font-medium text-[#374151]">
                  {mod.name}
                </span>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Modal de perfil */}
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
