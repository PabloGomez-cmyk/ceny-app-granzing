"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Sun, Moon, LogOut, UserCircle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(str: string): string {
  const parts = str.split(/[@.\s]+/);
  if (parts.length >= 2 && parts[0] && parts[1])
    return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.substring(0, 2).toUpperCase();
}

function getRoleLabel(role?: string): string {
  return role === "ADMIN" ? "Admin" : "Instalador";
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface UserMenuProps {
  name?: string | null;
  email: string;
  role?: string;
  onOpenProfile: () => void;
  /** "light" = header blanco (dashboard), "dark" = header verde (módulos) */
  variant?: "light" | "dark";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UserMenu({
  name,
  email,
  role,
  onOpenProfile,
  variant = "light",
}: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = name ?? email;
  const initials = getInitials(name ?? email);
  const roleLabel = getRoleLabel(role);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    }
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }

  // ── Trigger styles por variante ───────────────────────────────────────────

  const badgeCls =
    variant === "dark"
      ? "hidden max-w-[160px] truncate rounded-full border border-white/40 px-3 py-1 text-[12px] font-medium text-white hover:bg-white/10 sm:inline"
      : "hidden max-w-[160px] truncate rounded-full border border-[#0f6e50] px-3 py-1 text-[12px] font-medium text-[#0f6e50] hover:bg-[#f0faf6] sm:inline";

  const avatarCls =
    variant === "dark"
      ? "flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold text-white hover:bg-white/30"
      : "flex h-9 w-9 items-center justify-center rounded-full bg-[#0f6e50] text-[13px] font-bold text-white hover:opacity-90";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={badgeCls}>{displayName}</span>
        <div className={avatarCls}>{initials}</div>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[230px] overflow-hidden rounded-[14px] border border-[#e2e6f0] bg-white shadow-xl">
          {/* Info de usuario */}
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] p-4">
            <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#0f6e50] text-[14px] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              {name && (
                <p className="truncate text-[13px] font-semibold text-[#0f172a]">
                  {name}
                </p>
              )}
              <p className="truncate text-[11px] text-[#94a3b8]">{email}</p>
              <span className="mt-0.5 inline-block rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-semibold text-[#0f6e50]">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Ajustes */}
          <button
            onClick={() => { setOpen(false); router.push("/settings"); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] text-[#374151] transition-colors hover:bg-[#f8fafc]"
          >
            <UserCircle size={15} className="text-[#475569]" />
            Mi perfil y ajustes
          </button>

          {/* Toggle de tema */}
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] text-[#374151] transition-colors hover:bg-[#f8fafc]"
          >
            {theme === "light" ? (
              <Moon size={15} className="text-[#475569]" />
            ) : (
              <Sun size={15} className="text-[#475569]" />
            )}
            {theme === "light" ? "Modo oscuro" : "Modo claro"}
          </button>

          {/* Cerrar sesión */}
          <div className="border-t border-[#f1f5f9]">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
