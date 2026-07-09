"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2, Lock } from "lucide-react";
import { authApi } from "@/lib/api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch {
      // Error silencioso — no revelar si el email existe o no
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f4f6f9] lg:h-screen lg:flex-row lg:bg-white">
      {/* Panel izquierdo — Marca */}
      <div className="relative hidden w-[43%] overflow-hidden bg-[#d9622c] lg:flex lg:flex-col">
        <div className="absolute -left-20 -top-20 h-[420px] w-[420px] rounded-full bg-[#b74e1e] opacity-60" />
        <div className="absolute bottom-[-60px] right-[-60px] h-[300px] w-[300px] rounded-full bg-[#b74e1e] opacity-50" />
        <div className="relative z-10 flex h-full flex-col px-[60px] pt-[56px] pb-[28px]">
          <div className="flex items-center gap-3">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white">
              <Image src="/logo.png" alt="Intermedios" width={40} height={40} className="object-contain" />
            </div>
            <span className="font-bold text-[18px] text-white">Intermedios</span>
          </div>
          <div className="mt-auto">
            <p className="text-[15px] text-white/70">
              Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>
          </div>
          <p className="mt-auto text-[11px] text-white/70">© 2026 Intermedios</p>
        </div>
      </div>

      {/* Panel derecho — Formulario */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-8 lg:px-0 lg:py-0">
        <div className="w-full max-w-[390px]">
          <Link
            href="/login"
            className="mb-6 flex items-center gap-1.5 text-[13px] text-[#64748b] hover:text-[#0f172a]"
          >
            <ArrowLeft size={14} />
            Volver al inicio de sesión
          </Link>

          <div className="rounded-[18px] border border-[#e2e6f0] bg-white shadow-sm">
            {submitted ? (
              <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fbeee1]">
                  <CheckCircle2 size={28} className="text-[#d9622c]" />
                </div>
                <h1 className="font-bold text-[20px] text-[#0f172a]">Revisá tu email</h1>
                <p className="text-[13px] text-[#64748b]">
                  Si el email <span className="font-semibold text-[#0f172a]">{email}</span> está
                  registrado, recibirás un enlace para restablecer tu contraseña en los próximos
                  minutos.
                </p>
                <p className="text-[12px] text-[#94a3b8]">
                  El enlace expira en 1 hora. Revisá también tu carpeta de spam.
                </p>
                <Link
                  href="/login"
                  className="mt-2 w-full rounded-[12px] bg-[#d9622c] py-3 text-center font-bold text-[14px] text-white hover:bg-[#b74e1e]"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            ) : (
              <div className="px-8 pt-8 pb-6">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#fbeee1]">
                  <Mail size={18} className="text-[#d9622c]" />
                </div>
                <h1 className="mt-3 font-bold text-[22px] text-[#0f172a]">Recuperar contraseña</h1>
                <p className="mt-1 text-[13px] text-[#475569]">
                  Ingresá tu email y te enviaremos un enlace de recuperación.
                </p>
                <div className="mt-5 border-t border-[#e2e6f0]" />

                <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-[11px] text-[#475569]">
                      Email <span className="text-[#be123c]">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      autoComplete="email"
                      className="h-[44px] rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-2 focus:ring-[#d9622c]/20"
                    />
                  </div>

                  {error && (
                    <p className="text-[12px] text-red-600">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-[50px] w-full rounded-[12px] bg-[#d9622c] font-bold text-[15px] text-white hover:bg-[#b74e1e] disabled:opacity-60"
                  >
                    {loading ? "Enviando..." : "Enviar enlace de recuperación"}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-[8px] bg-[#fbeee1] px-4 py-2">
            <Lock size={12} className="text-[#f0a24d]" />
            <p className="text-[11px] text-[#f0a24d]">Datos protegidos con cifrado</p>
          </div>
        </div>
      </div>
    </div>
  );
}
