"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Share2, Loader2 } from "lucide-react";
import { QuotePDFDocument } from "@/lib/pdf/QuotePDF";
import type { Quote } from "@/lib/api/quotes";
import type { User } from "@/lib/api/users";

interface Props {
  quote: Quote;
  company: User | null;
  className?: string;
}

// Convierte cualquier formato (incluido WebP) a PNG base64 vía Canvas.
// react-pdf solo soporta PNG y JPG — WebP falla silenciosamente.
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

export default function SharePDFButton({ quote, company, className }: Props) {
  const [loading, setLoading] = useState(false);

  const cls =
    className ??
    "flex items-center gap-1.5 rounded-[10px] border border-[#dde4ee] px-3 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50";

  async function handleShare() {
    setLoading(true);
    try {
      const logoBase64 = company?.company_logo_url
        ? await toPngBase64(company.company_logo_url)
        : null;
      const companyWithLogo = company
        ? { ...company, company_logo_url: logoBase64 }
        : null;

      const blob = await pdf(
        <QuotePDFDocument quote={quote} company={companyWithLogo} />
      ).toBlob();
      const fileName = `${quote.quote_number}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: quote.quote_number,
          text: `Presupuesto ${quote.quote_number}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Error al compartir el PDF", err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleShare} disabled={loading} className={cls}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
      Compartir
    </button>
  );
}
