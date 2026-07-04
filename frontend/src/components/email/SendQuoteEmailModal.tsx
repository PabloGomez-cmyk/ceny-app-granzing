"use client";

import { useState, useEffect } from "react";
import { X, Mail, Send, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { useSendQuoteEmail, useGmailStatus } from "@/hooks/useGmail";
import { QuotePDFDocument } from "@/lib/pdf/QuotePDF";
import type { Quote } from "@/lib/api/quotes";
import type { User } from "@/lib/api/users";

interface Props {
  quoteId: string;
  quoteNumber: string;
  quote: Quote;
  company: User | null;
  customerEmail?: string;
  customerName?: string;
  onClose: () => void;
}

async function toPngBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmapUrl = URL.createObjectURL(blob);
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(bitmapUrl);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => { URL.revokeObjectURL(bitmapUrl); resolve(null); };
      img.src = bitmapUrl;
    });
  } catch {
    return null;
  }
}

async function generatePdfBase64(quote: Quote, company: User | null): Promise<string> {
  const logoBase64 = company?.company_logo_url
    ? await toPngBase64(company.company_logo_url)
    : null;

  const companyWithLogo = company
    ? { ...company, company_logo_url: logoBase64 }
    : null;

  const blob = await pdf(
    <QuotePDFDocument quote={quote} company={companyWithLogo} />
  ).toBlob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Quitar el prefijo "data:application/pdf;base64,"
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function SendQuoteEmailModal({
  quoteId,
  quoteNumber,
  quote,
  company,
  customerEmail = "",
  customerName = "",
  onClose,
}: Props) {
  const { data: gmailStatus } = useGmailStatus();
  const sendEmail = useSendQuoteEmail();

  const [recipientEmail, setRecipientEmail] = useState(customerEmail);
  const [recipientName, setRecipientName] = useState(customerName);
  const [customMessage, setCustomMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

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
    setGeneratingPdf(true);

    let pdfBase64: string | null = null;
    try {
      pdfBase64 = await generatePdfBase64(quote, company);
    } catch {
      // Si falla la generación del PDF, enviamos el mail sin adjunto
      pdfBase64 = null;
    } finally {
      setGeneratingPdf(false);
    }

    try {
      await sendEmail.mutateAsync({
        quoteId,
        payload: {
          recipient_email: recipientEmail,
          recipient_name: recipientName || undefined,
          custom_message: customMessage || undefined,
          pdf_base64: pdfBase64,
        },
      });
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al enviar el correo";
      setError(msg);
    }
  }

  const isBusy = generatingPdf || sendEmail.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[480px] rounded-[16px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8ecf2] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#f0f9f6]">
              <Mail size={15} className="text-[#0f6e50]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0f172a]">Enviar presupuesto</p>
              <p className="text-[11px] text-[#94a3b8]">{quoteNumber}</p>
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
                  para poder enviar presupuestos.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-[8px] bg-[#f0f9f6] px-3 py-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#0f6e50]" />
              <p className="text-[11px] text-[#0f6e50]">
                Enviando desde <span className="font-semibold">{senderEmail}</span>
              </p>
            </div>
          )}

          {/* Resultado enviado */}
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0f9f6]">
                <CheckCircle2 size={24} className="text-[#0f6e50]" />
              </div>
              <p className="text-[14px] font-semibold text-[#0f172a]">¡Correo enviado!</p>
              <p className="text-center text-[12px] text-[#64748b]">
                El presupuesto fue enviado a{" "}
                <span className="font-semibold">{recipientEmail}</span>
              </p>
              <button
                onClick={onClose}
                className="mt-2 rounded-[10px] bg-[#0f6e50] px-6 py-2 text-[12px] font-semibold text-white hover:bg-[#0d5f44]"
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
                  className="h-[38px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20"
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
                  className="h-[38px] w-full rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20"
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
                  placeholder="Adjunto encontrará el presupuesto solicitado..."
                  rows={3}
                  className="w-full resize-none rounded-[10px] border border-[#dde4ee] bg-[#f8fafc] px-3 py-2.5 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f6e50] focus:outline-none focus:ring-1 focus:ring-[#0f6e50]/20"
                />
              </div>

              {/* Indicador de adjunto */}
              <div className="flex items-center gap-2 rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[11px] text-[#64748b]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.47"/>
                </svg>
                Se adjuntará <span className="font-semibold">{quoteNumber}.pdf</span>
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
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#0f6e50] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0d5f44] disabled:opacity-50"
                >
                  {isBusy ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      {generatingPdf ? "Generando PDF..." : "Enviando..."}
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Enviar presupuesto
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
