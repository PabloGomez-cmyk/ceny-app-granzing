"use client";

import { useState, useEffect } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import { QuotePDFDocument } from "@/lib/pdf/QuotePDF";
import type { Quote } from "@/lib/api/quotes";
import type { User } from "@/lib/api/users";

interface Props {
  quote: Quote;
  company: User | null;
  variant?: "primary" | "outline";
  label?: string;
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

export default function DownloadPDFButton({
  quote,
  company,
  variant = "outline",
  label = "Descargar PDF",
  className,
}: Props) {
  const [logoBase64, setLogoBase64] = useState<string | null | undefined>(
    undefined // undefined = todavía cargando; null = sin logo o error
  );

  useEffect(() => {
    if (!company?.company_logo_url) {
      setLogoBase64(null);
      return;
    }
    toPngBase64(company.company_logo_url).then(setLogoBase64);
  }, [company?.company_logo_url]);

  const base =
    variant === "primary"
      ? "flex items-center gap-1.5 rounded-[10px] bg-[#d9622c] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#b74e1e] disabled:opacity-50"
      : "flex items-center gap-1.5 rounded-[10px] border border-[#dde4ee] px-4 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50";

  const cls = className ?? base;

  // Aún cargando el logo
  if (logoBase64 === undefined) {
    return (
      <button disabled className={cls}>
        <Loader2 size={13} className="animate-spin" />
        Preparando...
      </button>
    );
  }

  const companyWithBase64 = company
    ? { ...company, company_logo_url: logoBase64 }
    : null;

  return (
    <PDFDownloadLink
      document={<QuotePDFDocument quote={quote} company={companyWithBase64} />}
      fileName={`${quote.quote_number}.pdf`}
      className={cls}
      style={{ textDecoration: "none" }}
    >
      {({ loading }) =>
        loading ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Generando...
          </>
        ) : (
          <>
            <Download size={13} />
            {label}
          </>
        )
      }
    </PDFDownloadLink>
  );
}
