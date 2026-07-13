"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  email: z.email({ error: "Email inválido" }),
  password: z.string().min(1, { error: "La contraseña es requerida" }),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setAuthError(null);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setAuthError("Email o contraseña incorrectos. Intentá de nuevo.");
    } else {
      router.replace("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f4f6f9] lg:h-screen lg:flex-row lg:bg-white">

      {/* ── Header móvil — solo visible en small screens ────────────────────── */}
      <div className="relative overflow-hidden bg-[#d9622c] px-6 pb-10 pt-10 lg:hidden">
        <div className="absolute -left-10 -top-10 h-[180px] w-[180px] rounded-full bg-[#b74e1e] opacity-50" />
        <div className="absolute -bottom-8 -right-8 h-[140px] w-[140px] rounded-full bg-[#b74e1e] opacity-40" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white">
            <Image src="/logo.png" alt="Intermedios" width={40} height={40} className="object-contain" />
          </div>
          <span className="mt-3 font-bold text-[20px] text-white">Intermedios</span>
          <p className="mt-1 text-[13px] text-white/70">Plataforma para instaladores de láminas</p>
          <p className="mt-4 text-[11px] text-white/50">Presupuestos · Garantías </p>
        </div>
      </div>

      {/* ── Panel izquierdo — Marca (solo desktop) ──────────────────────────── */}
      <div className="relative hidden w-[43%] overflow-hidden bg-[#d9622c] lg:flex lg:flex-col">
        {/* Esferas decorativas */}
        <div className="absolute -left-20 -top-20 h-[420px] w-[420px] rounded-full bg-[#b74e1e] opacity-60" />
        <div className="absolute bottom-[-60px] right-[-60px] h-[300px] w-[300px] rounded-full bg-[#b74e1e] opacity-50" />
        <div className="absolute right-[30px] top-[380px] h-[140px] w-[140px] rounded-full bg-[#b74e1e] opacity-40" />

        <div className="relative z-10 flex h-full flex-col px-[60px] pt-[56px] pb-[28px]">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white">
              <Image src="/logo.png" alt="Intermedios" width={40} height={40} className="object-contain" />
            </div>
            <span className="font-bold text-[18px] text-white">Intermedios</span>
          </div>

          <p className="mt-5 text-[12px] text-white/50">
            Plataforma de gestión para instaladores
          </p>

          {/* Headline */}
          <div className="mt-12">
            <p className="font-bold text-[56px] leading-tight text-white">Presupuestá.</p>
            <p className="font-bold text-[56px] leading-tight text-white">Vendé.</p>
            <p className="font-bold text-[56px] leading-tight text-white/45">Crecé.</p>
          </div>

          <p className="mt-8 text-[15px] leading-snug text-white/70">
            La plataforma especializada para
            <br />
            instaladores de láminas.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-col gap-[10px]">
            {[
              "✓  Presupuestos automáticos",
              "✓  Listas de precios personalizadas",
              "✓  Garantías automotrices",
            ].map((feat) => (
              <div
                key={feat}
                className="w-[330px] rounded-[9px] border border-white/25 bg-white/5 px-4 py-[10px] text-[13px] text-white"
              >
                {feat}
              </div>
            ))}
          </div>

          <p className="mt-auto text-[11px] text-white/70">© 2026 Intermedios</p>
        </div>
      </div>

      {/* ── Panel derecho — Formulario ──────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8 lg:px-0 lg:py-0">
        {/* Esferas decorativas */}
        <div className="absolute -right-10 -top-20 h-[260px] w-[260px] rounded-full bg-[#d9622c]/5 opacity-30" />
        <div className="absolute -bottom-14 -left-10 h-[200px] w-[200px] rounded-full bg-[#d9622c]/5 opacity-20" />

        <div className="relative z-10 flex w-full max-w-[390px] flex-col gap-6">
          {/* Card */}
          <div className="rounded-[18px] border border-[#e2e6f0] bg-white shadow-sm">
            <div className="px-8 pt-8 pb-6">
              <h1 className="font-bold text-[24px] text-[#0f172a]">Bienvenido</h1>
              <p className="mt-1 text-[13px] text-[#475569]">Ingresá a tu cuenta para continuar</p>
              <div className="mt-6 border-t border-[#e2e6f0]" />

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4" noValidate>
                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[11px] text-[#475569]">
                    Email <span className="text-[#be123c]">*</span>
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="tu@email.com"
                    autoComplete="email"
                    className="h-[44px] rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] px-3.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-2 focus:ring-[#d9622c]/20"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-[#be123c]">{errors.email.message}</p>
                  )}
                </div>

                {/* Contraseña */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[11px] text-[#475569]">
                    Contraseña <span className="text-[#be123c]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••"
                      autoComplete="current-password"
                      className="h-[44px] w-full rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] pl-3.5 pr-10 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-2 focus:ring-[#d9622c]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[11px] text-[#be123c]">{errors.password.message}</p>
                  )}
                </div>

                {/* Recordar sesión + Olvidaste contraseña */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setRememberMe((v) => !v)}
                    className="flex items-center gap-2"
                    aria-pressed={rememberMe}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors ${
                        rememberMe ? "bg-[#d9622c]" : "border border-[#cbd5e1]"
                      }`}
                    >
                      {rememberMe && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="text-[12px] text-[#475569]">Recordar sesión</span>
                  </button>
                  <Link
                    href="/forgot-password"
                    className="text-[12px] font-medium text-[#d9622c] hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>

                {/* Error de autenticación */}
                {authError && (
                  <div className="flex items-center gap-2 rounded-[8px] border border-[#be123c] bg-[#ffe4ec] px-3 py-2">
                    <div className="h-5 w-1 shrink-0 rounded-sm bg-[#be123c]" />
                    <p className="text-[11px] text-[#be123c]">{authError}</p>
                  </div>
                )}

                {/* Botón */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 h-[50px] w-full rounded-[12px] bg-[#d9622c] font-bold text-[15px] text-white transition-colors hover:bg-[#b74e1e] disabled:opacity-60"
                >
                  {isSubmitting ? "Ingresando..." : "Ingresar"}
                </button>
              </form>
            </div>

            <div className="border-t border-[#f1f5f9] px-8 py-4">
              <p className="text-center text-[12px] text-[#94a3b8]">
                ¿No tenés cuenta? Contactá a tu administrador.
              </p>
            </div>
          </div>

          {/* Footer de seguridad */}
          <div className="flex items-center justify-center gap-1.5 rounded-[8px] bg-[#fbeee1] px-4 py-2">
            <Lock size={12} className="text-[#f0a24d]" />
            <p className="text-[11px] text-[#f0a24d]">
              Datos protegidos con cifrado · v2.4.1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
