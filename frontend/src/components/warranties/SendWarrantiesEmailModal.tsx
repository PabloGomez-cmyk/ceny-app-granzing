"use client";

import { useState, useEffect } from "react";
import { X, ShieldCheck, Send, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useSendWarrantiesEmail } from "@/hooks/useWarranties";
import { useGmailStatus } from "@/hooks/useGmail";
import type { Warranty } from "@/lib/api/warranties";

interface Props {
  quoteId: string;
  quoteNumber: string;
  warranties: Warranty[];
  customerEmail?: string;
  customerName?: string;
  onClose: () => void;
}

export default function SendWarrantiesEmailModal({
  quoteId,
  quoteNumber,
  warranties,
  customerEmail = "",
  customerName = "",
  onClose,
}: Props) {
  const { data: gmailStatus } = useGmailStatus();
  const sendEmail = useSendWarrantiesEmail();

  const [recipientEmail, setRecipientEmail] = useState(customerEmail);
  const [recipientName, setRecipientName] = useState(customerName);
  const [customMessage, setCustomMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isConnected = gmailStatus?.connected ?? false;
  const senderEmail = gmailStatus?.gmail_email ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await sendEmail.mutateAsync({
        quoteId,
        payload: {
          recipient_email: recipientEmail,
          recipient_name: recipientName || undefined,
          custom_message: customMessage || undefined,
        },
      });
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al enviar el correo";
      setError(msg);
    }
  }

  const isBusy = sendEmail.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[480px] rounded-[16px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8ecf2] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#fbeee1]">
              <ShieldCheck size={15} className="text-[#d9622c]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0f172a]">Enviar garantía</p>
              <p className="text-[11px] text-[#94a3b8]">
                {quoteNumber} · {warranties.length} producto{warranties.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#94a3b8] hover:bg-[#f1f5f9]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Estado Gmail */}
          {!isConnected ? (
            <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-[12px] font-semibold text-amber-700">Gmail no conectado</p>
                <p className="mt-0.5 text-[11px] text-amber-600">
                  Configurá tu cuenta de Gmail en{" "}
                  <a href="/settings?tab=email" className="underline">
                    Ajustes → Correo
                  </a>{" "}
                  para poder enviar garantías.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-[8px] bg-[#fbeee1] px-3 py-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#d9622c]" />
              <p className="text-[11px] text-[#d9622c]">
                Enviando desde <span className="font-semibold">{senderEmail}</span>
              </p>
            </div>
          )}

          {/* Resultado enviado */}
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee1]">
                <CheckCircle2 size={24} className="text-[#d9622c]" />
              </div>
              <p className="text-[14px] font-semibold text-[#0f172a]">¡Garantía enviada!</p>
              <p className="text-center text-[12px] text-[#64748b]">
                La garantía oficial fue enviada a{" "}
                <span className="font-semibold">{recipientEmail}</span>
              </p>
              <button
                onClick={onClose}
                className="mt-2 rounded-[10px] bg-[#d9622c] px-6 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e]"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#374151]">
                  Email del destinatario <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                  className="h-[38px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#374151]">
                  Nombre del destinatario
                  <span className="ml-1 text-[11px] font-normal text-[#94a3b8]">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="h-[38px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#374151]">
                  Mensaje personalizado
                  <span className="ml-1 text-[11px] font-normal text-[#94a3b8]">(opcional)</span>
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Adjunto encontrará la garantía oficial de su instalación..."
                  rows={3}
                  className="w-full resize-none rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 py-2.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#d9622c] focus:outline-none focus:ring-1 focus:ring-[#d9622c]/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[11px] text-[#64748b]">
                <ShieldCheck size={13} className="text-[#d9622c]" />
                Incluye garantía de {warranties.map((w) => String(w.product_snapshot.name ?? "")).join(", ")}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-500" />
                  <p className="text-[12px] text-red-600">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isBusy}
                  className="rounded-[10px] border border-[#dde4ee] px-4 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isConnected || isBusy}
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
                >
                  {isBusy ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Enviar garantía
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
