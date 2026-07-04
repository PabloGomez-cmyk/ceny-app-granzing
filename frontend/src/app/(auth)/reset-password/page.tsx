"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle2, XCircle, Lock, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [tokenState, setTokenState] = useState<"validating" | "valid" | "invalid">("validating");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }
    authApi.validateResetToken(token).then((res) => {
      if (res.valid) {
        setTokenState("valid");
        setUserEmail(res.email);
      } else {
        setTokenState("invalid");
      }
    }).catch(() => setTokenState("invalid"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f4f6f9] lg:h-screen lg:flex-row lg:bg-white">
      {/* Panel izquierdo */}
      <div className="relative hidden w-[43%] overflow-hidden bg-[#0f6e50] lg:flex lg:flex-col">
        <div className="absolute -left-20 -top-20 h-[420px] w-[420px] rounded-full bg-[#0d6347] opacity-60" />
        <div className="absolute bottom-[-60px] right-[-60px] h-[300px] w-[300px] rounded-full bg-[#0d6347] opacity-50" />
        <div className="relative z-10 flex h-full flex-col px-[60px] pt-[56px] pb-[28px]">
          <div className="flex items-center gap-3">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white">
              <span className="font-bold text-[30px] text-[#0f6e50]">G</span>
            </div>
            <span className="font-bold text-[18px] text-white">Glazing Platform</span>
          </div>
          <div className="mt-auto">
            <p className="text-[15px] text-white/70">Creá una nueva contraseña segura para tu cuenta.</p>
          </div>
          <p className="mt-auto text-[11px] text-white/70">© 2026 Glazing</p>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-8 lg:px-0 lg:py-0">
        <div className="w-full max-w-[390px]">
          <div className="rounded-[18px] border border-[#e2e6f0] bg-white shadow-sm">

            {/* Validando token */}
            {tokenState === "validating" && (
              <div className="flex flex-col items-center gap-3 px-8 py-12">
                <Loader2 size={28} className="animate-spin text-[#0f6e50]" />
                <p className="text-[13px] text-[#64748b]">Verificando enlace...</p>
              </div>
            )}

            {/* Token inválido / expirado */}
            {tokenState === "invalid" && (
              <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                  <XCircle size={28} className="text-red-500" />
                </div>
                <h1 className="font-bold text-[20px] text-[#0f172a]">Enlace inválido</h1>
                <p className="text-[13px] text-[#64748b]">
                  El enlace de recuperación es inválido o ya expiró. Solicitá uno nuevo.
                </p>
                <Link
                  href="/forgot-password"
                  className="mt-2 w-full rounded-[12px] bg-[#0f6e50] py-3 text-center font-bold text-[14px] text-white hover:bg-[#0a5a40]"
                >
                  Solicitar nuevo enlace
                </Link>
              </div>
            )}

            {/* Éxito */}
            {done && (
              <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f9f6]">
                  <CheckCircle2 size={28} className="text-[#0f6e50]" />
                </div>
                <h1 className="font-bold text-[20px] text-[#0f172a]">¡Contraseña actualizada!</h1>
                <p className="text-[13px] text-[#64748b]">
                  Tu contraseña fue restablecida correctamente. Serás redirigido al inicio de sesión.
                </p>
                <Loader2 size={16} className="animate-spin text-[#94a3b8]" />
              </div>
            )}

            {/* Formulario */}
            {tokenState === "valid" && !done && (
              <div className="px-8 pt-8 pb-6">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f0f9f6]">
                  <Lock size={18} className="text-[#0f6e50]" />
                </div>
                <h1 className="mt-3 font-bold text-[22px] text-[#0f172a]">Nueva contraseña</h1>
                {userEmail && (
                  <p className="mt-1 text-[13px] text-[#475569]">
                    Cuenta: <span className="font-semibold text-[#0f172a]">{userEmail}</span>
                  </p>
                )}
                <div className="mt-5 border-t border-[#e2e6f0]" />

                <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-[11px] text-[#475569]">
                      Nueva contraseña <span className="text-[#be123c]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="new-password"
                        className="h-[44px] w-full rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] pl-3.5 pr-10 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-2 focus:ring-[#0f6e50]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-[11px] text-[#475569]">
                      Confirmar contraseña <span className="text-[#be123c]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repetí la contraseña"
                        autoComplete="new-password"
                        className="h-[44px] w-full rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] pl-3.5 pr-10 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-2 focus:ring-[#0f6e50]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-[8px] border border-[#be123c] bg-[#ffe4ec] px-3 py-2">
                      <div className="h-5 w-1 shrink-0 rounded-sm bg-[#be123c]" />
                      <p className="text-[11px] text-[#be123c]">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-[50px] w-full rounded-[12px] bg-[#0f6e50] font-bold text-[15px] text-white hover:bg-[#0a5a40] disabled:opacity-60"
                  >
                    {loading ? "Guardando..." : "Restablecer contraseña"}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-[8px] bg-[#dcfce7] px-4 py-2">
            <Lock size={12} className="text-[#1d9e75]" />
            <p className="text-[11px] text-[#1d9e75]">Datos protegidos con cifrado</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
