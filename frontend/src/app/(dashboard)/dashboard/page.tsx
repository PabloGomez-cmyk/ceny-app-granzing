"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import ProfileModal from "@/components/profile/ProfileModal";
import UserMenu from "@/components/layout/UserMenu";
import { useState } from "react";
import { MODULES } from "@/lib/dashboardModules";

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
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white">
            <Image src="/logo.png" alt="Intermedios" width={26} height={26} className="object-contain" />
          </div>
          <span className="hidden text-[15px] font-semibold text-[#1a1a2e] sm:inline">
            Intermedios
          </span>
          <span className="text-[15px] font-semibold text-[#1a1a2e] sm:hidden">
            Intermedios
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
            data-tour="dashboard-search"
            className="w-full rounded-[10px] border border-[#dde4ee] bg-white px-4 py-2.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-sm focus:border-[#d9622c] focus:outline-none focus:ring-2 focus:ring-[#d9622c]/20"
          />
        </div>

        <div className="mt-10 grid grid-cols-3 gap-x-8 gap-y-8 sm:grid-cols-4 lg:grid-cols-5">
          {visible.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.name}
                href={mod.href as never}
                data-tour={mod.tourId}
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
