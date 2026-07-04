"use client";

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Quote } from "@/lib/api/quotes";
import type { User } from "@/lib/api/users";

// ── Paleta ────────────────────────────────────────────────────────────────────

const DARK = "#0f172a";
const GRAY = "#64748b";
const GRAY_LIGHT = "#94a3b8";
const BORDER = "#e2e8f0";
const BG = "#f8fafc";

// ── Estilos (dinámicos por colores de empresa) ─────────────────────────────────

function makeStyles(GREEN: string, GREEN_LIGHT: string) {
  return StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: DARK,
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 44,
    backgroundColor: "#fff",
  },

  // ── TOP: logo izq + datos empresa der ──────────────────────────────────────
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  logoWrap: {
    width: 72,
    height: 72,
    marginRight: 16,
    flexShrink: 0,
  },
  logoImg: {
    width: 72,
    height: 72,
    objectFit: "contain",
    borderRadius: 6,
  },
  logoInitialBox: {
    width: 72,
    height: 72,
    borderRadius: 6,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  logoInitialText: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
  },

  // datos empresa — alineados a la derecha
  companyBlock: {
    flex: 1,
    alignItems: "flex-end",
  },
  companyName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    marginBottom: 3,
    textAlign: "right",
  },
  companyMeta: {
    fontSize: 8.5,
    color: GRAY,
    textAlign: "right",
    marginTop: 1.5,
  },

  // ── DIVISOR VERDE ───────────────────────────────────────────────────────────
  dividerGreen: {
    height: 2,
    backgroundColor: GREEN,
    marginBottom: 20,
    borderRadius: 1,
  },

  // ── BLOQUE CLIENTE + NRO PRESUPUESTO ───────────────────────────────────────
  midRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  clientBlock: {
    flex: 1,
  },
  clientLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GRAY_LIGHT,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  clientName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 2,
  },
  clientMeta: {
    fontSize: 8.5,
    color: GRAY,
    marginTop: 1.5,
  },
  quoteNumberBlock: {
    alignItems: "flex-end",
  },
  quoteNumberLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY_LIGHT,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  quoteNumber: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
  },

  // ── BARRA INFO (fecha / vencimiento / estado) ───────────────────────────────
  infoBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 22,
  },
  infoCell: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  infoCellLast: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  infoCellLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoCellValue: {
    fontSize: 9,
    color: DARK,
  },

  // ── SECCIÓN TÍTULO ──────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 5,
    marginTop: 16,
  },

  // ── TABLA ───────────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: "row",
    backgroundColor: GREEN,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 1,
  },
  tableHeaderCell: {
    color: "#fff",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  tableRowAlt: { backgroundColor: BG },
  tableCell: { fontSize: 8.5, color: DARK },

  // col widths vidrios
  cId:   { width: "11%" },
  cTipo: { width: "17%" },
  cDim:  { width: "22%" },
  cM2:   { width: "13%" },
  cQty:  { width: "10%" },
  cM2T:  { width: "13%" },
  cUb:   { width: "14%" },

  // col widths materiales
  cProd:  { width: "44%" },
  cSup:   { width: "18%" },
  cPUnit: { width: "20%" },
  cSubt:  { width: "18%" },

  // ── TOTALES ─────────────────────────────────────────────────────────────────
  totalsWrap: {
    marginTop: 14,
    alignItems: "flex-end",
  },
  totalsBox: {
    width: 210,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    overflow: "hidden",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: GREEN,
  },
  totalsLabel: { fontSize: 8, color: GRAY },
  totalsValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: DARK },
  totalsFinalLabel: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#fff" },
  totalsFinalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#fff" },

  // ── CONDICIONES ─────────────────────────────────────────────────────────────
  condBox: {
    marginTop: 10,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
  },
  condText: { fontSize: 8, color: GRAY, lineHeight: 1.6 },

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: GRAY_LIGHT },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(n: number | string) {
  return "$ " + Math.round(Number(n)).toLocaleString("es-AR");
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "En cotización",
  SENT: "Enviado",
  ACCEPTED: "Aceptado",
  INVOICED: "Facturado",
  CANCELLED: "Cancelado",
};

// ── Documento PDF ─────────────────────────────────────────────────────────────

interface Props {
  quote: Quote;
  company: User | null;
}

export function QuotePDFDocument({ quote, company }: Props) {
  const snap = quote.customer_snapshot as Record<string, string> | null;
  const companyName = company?.company_name ?? "Mi Empresa";
  const logo = company?.company_logo_url ?? null;

  const s = makeStyles(
    company?.company_color_primary ?? "#0f6e50",
    company?.company_color_secondary ?? "#e8f5f0",
  );

  // Datos empresa para el header
  const addressParts = [
    company?.company_street,
    company?.company_city,
    company?.company_province,
    company?.company_postal_code,
  ].filter(Boolean);

  const t = quote.totals;
  const totalM2 = quote.glass_panes.reduce((s, p) => s + Number(p.surface_m2), 0);

  return (
    <Document title={`Presupuesto ${quote.quote_number}`} author={companyName}>
      <Page size="A4" style={s.page}>

        {/* ── TOP: logo izq | datos empresa der ─────────────────────────── */}
        <View style={s.topRow}>
          {/* Logo */}
          <View style={s.logoWrap}>
            {logo ? (
              <Image src={logo} style={s.logoImg} />
            ) : (
              <View style={s.logoInitialBox}>
                <Text style={s.logoInitialText}>{getInitials(companyName)}</Text>
              </View>
            )}
          </View>

          {/* Datos empresa alineados a la derecha */}
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{companyName}</Text>
            {company?.company_cuit ? (
              <Text style={s.companyMeta}>CUIT: {company.company_cuit}</Text>
            ) : null}
            {addressParts.length > 0 ? (
              <Text style={s.companyMeta}>{addressParts.join(", ")}</Text>
            ) : null}
          </View>
        </View>

        {/* ── DIVISOR VERDE ─────────────────────────────────────────────── */}
        <View style={s.dividerGreen} />

        {/* ── CLIENTE izq | NÚMERO PRESUPUESTO der ──────────────────────── */}
        <View style={s.midRow}>
          <View style={s.clientBlock}>
            <Text style={s.clientLabel}>Cliente</Text>
            <Text style={s.clientName}>
              {snap?.name ?? "Sin cliente"}
            </Text>
            {snap?.phone ? (
              <Text style={s.clientMeta}>{snap.phone}</Text>
            ) : null}
            {snap?.address ? (
              <Text style={s.clientMeta}>{snap.address}</Text>
            ) : null}
            <Text style={[s.clientMeta, { marginTop: 4, color: GRAY }]}>
              {totalM2.toFixed(2)} m² totales
            </Text>
          </View>

          <View style={s.quoteNumberBlock}>
            <Text style={s.quoteNumberLabel}>Presupuesto</Text>
            <Text style={s.quoteNumber}>{quote.quote_number}</Text>
          </View>
        </View>

        {/* ── BARRA INFO ────────────────────────────────────────────────── */}
        <View style={s.infoBar}>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Fecha de emisión</Text>
            <Text style={s.infoCellValue}>
              {new Date(quote.created_at).toLocaleDateString("es-AR", {
                day: "2-digit", month: "2-digit", year: "numeric",
              })}
            </Text>
          </View>
          {quote.valid_until ? (
            <View style={s.infoCell}>
              <Text style={s.infoCellLabel}>Válido hasta</Text>
              <Text style={s.infoCellValue}>{quote.valid_until}</Text>
            </View>
          ) : null}
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Estado</Text>
            <Text style={s.infoCellValue}>{STATUS_LABEL[quote.status] ?? quote.status}</Text>
          </View>
          <View style={s.infoCellLast}>
            <Text style={s.infoCellLabel}>Superficie total</Text>
            <Text style={s.infoCellValue}>{totalM2.toFixed(2)} m²</Text>
          </View>
        </View>

        {/* ── TABLA VIDRIOS ─────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Detalle de vidrios</Text>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.cId]}>ID</Text>
          <Text style={[s.tableHeaderCell, s.cTipo]}>Tipo</Text>
          <Text style={[s.tableHeaderCell, s.cDim]}>Dimensiones</Text>
          <Text style={[s.tableHeaderCell, s.cM2]}>m² c/u</Text>
          <Text style={[s.tableHeaderCell, s.cQty]}>Cant.</Text>
          <Text style={[s.tableHeaderCell, s.cM2T]}>m² total</Text>
          <Text style={[s.tableHeaderCell, s.cUb]}>Ubic.</Text>
        </View>
        {quote.glass_panes.map((p, i) => (
          <View key={p.pane_id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCell, s.cId, { fontFamily: "Helvetica-Bold" }]}>{p.pane_id}</Text>
            <Text style={[s.tableCell, s.cTipo]}>{p.glass_type_name}</Text>
            <Text style={[s.tableCell, s.cDim]}>{p.width_cm} × {p.height_cm} cm</Text>
            <Text style={[s.tableCell, s.cM2]}>{Number(p.surface_m2).toFixed(3)}</Text>
            <Text style={[s.tableCell, s.cQty]}>{p.quantity}</Text>
            <Text style={[s.tableCell, s.cM2T]}>{(Number(p.surface_m2) * p.quantity).toFixed(3)}</Text>
            <Text style={[s.tableCell, s.cUb]}>{p.location === "ALTURA" ? "Altura" : "Sup."}</Text>
          </View>
        ))}

        {/* ── TABLA MATERIALES ──────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Materiales / Láminas</Text>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.cProd]}>Producto</Text>
          <Text style={[s.tableHeaderCell, s.cSup]}>Superficie (m²)</Text>
          <Text style={[s.tableHeaderCell, s.cPUnit]}>Precio / m²</Text>
          <Text style={[s.tableHeaderCell, s.cSubt]}>Subtotal</Text>
        </View>
        {quote.lines.map((line, i) => {
          const linesnap = line.product_snapshot as Record<string, string | number>;
          return (
            <View key={line.line_id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.tableCell, s.cProd, { fontFamily: "Helvetica-Bold" }]}>
                {String(linesnap.name ?? "")}
              </Text>
              <Text style={[s.tableCell, s.cSup]}>{Number(line.surface_m2).toFixed(3)}</Text>
              <Text style={[s.tableCell, s.cPUnit]}>{money(line.price_per_m2)}</Text>
              <Text style={[s.tableCell, s.cSubt, { fontFamily: "Helvetica-Bold" }]}>
                {money(line.subtotal)}
              </Text>
            </View>
          );
        })}

        {/* ── TOTALES ───────────────────────────────────────────────────── */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Subtotal materiales</Text>
              <Text style={s.totalsValue}>{money(t.materials_subtotal)}</Text>
            </View>
            {Number(t.height_surcharge) > 0 && (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>Recargo altura ({quote.height_surcharge_pct}%)</Text>
                <Text style={s.totalsValue}>{money(t.height_surcharge)}</Text>
              </View>
            )}
            {Number(t.travel_cost) > 0 && (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>Viáticos</Text>
                <Text style={s.totalsValue}>{money(t.travel_cost)}</Text>
              </View>
            )}
            {Number(t.discount_amount) !== 0 && (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>
                  {Number(quote.discount_pct) >= 0
                    ? `Descuento (${quote.discount_pct}%)`
                    : `Recargo (${Math.abs(Number(quote.discount_pct))}%)`}
                </Text>
                <Text style={s.totalsValue}>- {money(t.discount_amount)}</Text>
              </View>
            )}
            {Number(t.tax_amount) > 0 && (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>IVA ({quote.tax_pct}%)</Text>
                <Text style={s.totalsValue}>{money(t.tax_amount)}</Text>
              </View>
            )}
            <View style={s.totalsFinalRow}>
              <Text style={s.totalsFinalLabel}>TOTAL</Text>
              <Text style={s.totalsFinalValue}>{money(t.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── CONDICIONES COMERCIALES ───────────────────────────────────── */}
        {quote.commercial_conditions ? (
          <>
            <Text style={s.sectionTitle}>Condiciones Comerciales</Text>
            <View style={s.condBox}>
              <Text style={s.condText}>{quote.commercial_conditions}</Text>
            </View>
          </>
        ) : null}

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {companyName}
            {company?.company_cuit ? ` · CUIT ${company.company_cuit}` : ""}
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
