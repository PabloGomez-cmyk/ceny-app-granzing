"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { gmailApi } from "@/lib/api/gmail";

type State = "loading" | "success" | "error";

export default function GmailCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
          <Loader2 size={40} className="animate-spin text-[#0f6e50]" />
        </div>
      }
    >
      <GmailCallbackContent />
    </Suspense>
  );
}

function GmailCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !token) return;
    ran.current = true;

    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (oauthError || !code) {
      setState("error");
      setErrorMsg(
        oauthError === "access_denied"
          ? "Cancelaste la conexión con Gmail."
          : "No se recibió el código de autorización de Google."
      );
      return;
    }

    const redirectUri = `${window.location.origin}/settings/gmail/callback`;

    gmailApi
      .connect(token, code, redirectUri)
      .then(() => {
        setState("success");
        setTimeout(() => router.replace("/settings?tab=email"), 2000);
      })
      .catch((err: unknown) => {
        setState("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Error al conectar Gmail."
        );
      });
  }, [token, searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] px-4">
      <div className="w-full max-w-[380px] rounded-[20px] border border-[#e2e6f0] bg-white p-8 text-center shadow-sm">
        {state === "loading" && (
          <>
            <Loader2 size={40} className="mx-auto mb-4 animate-spin text-[#0f6e50]" />
            <p className="font-semibold text-[#0f172a]">Conectando Gmail...</p>
            <p className="mt-1 text-[13px] text-[#94a3b8]">
              Estamos guardando tus credenciales de forma segura.
            </p>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 size={40} className="mx-auto mb-4 text-emerald-500" />
            <p className="font-semibold text-[#0f172a]">¡Gmail conectado!</p>
            <p className="mt-1 text-[13px] text-[#94a3b8]">
              Ya podés enviar presupuestos desde tu cuenta. Redirigiendo...
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle size={40} className="mx-auto mb-4 text-red-500" />
            <p className="font-semibold text-[#0f172a]">Error al conectar Gmail</p>
            <p className="mt-1 text-[13px] text-[#94a3b8]">{errorMsg}</p>
            <button
              onClick={() => router.replace("/settings?tab=email")}
              className="mt-5 h-[40px] w-full rounded-[10px] bg-[#0f6e50] text-[13px] font-semibold text-white hover:bg-[#0a5a40]"
            >
              Volver a Ajustes
            </button>
          </>
        )}
      </div>
    </div>
  );
}
