export interface CutPiece {
  pane_id: string;
  label: string;
  width_cm: number;
  height_cm: number;
  rotated: boolean;
  pano_index?: number;
  pano_total?: number;
}

export interface CutRow {
  pieces: CutPiece[];
  row_height_cm: number;
  used_width_cm: number;
}

export const PANE_COLORS = ["#22c55e", "#8b5cf6", "#3b82f6", "#f97316", "#ec4899", "#06b6d4", "#84cc16"];

export function CutDiagram({ rows, rollWidthCm = 152, paneIds, gapCm = 0 }: { rows: CutRow[]; rollWidthCm?: number; paneIds: string[]; gapCm?: number }) {
  const COORD_W = 800;
  const SCALE = COORD_W / rollWidthCm;
  const gapPx = gapCm * SCALE;
  const rowHeights = rows.map((r) => r.row_height_cm * SCALE);
  const totalH = Math.max(rowHeights.reduce((s, h) => s + h, 0), 80);
  const uniquePaneIds = [...new Set(paneIds)];

  let yOffset = 0;
  return (
    <div className="overflow-hidden rounded-xl border border-[#e8ecf2] bg-[#f8fafc]">
      <svg
        viewBox={`0 0 ${COORD_W + 4} ${totalH + 4}`}
        width="100%"
        style={{ display: "block", minHeight: 220 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={0} y={0} width={COORD_W + 4} height={totalH + 4} fill="#f1f5f9" />
        {rows.map((row, ri) => {
          const rowY = yOffset;
          const rowH = row.row_height_cm * SCALE;
          yOffset += rowH;
          let xStart = 2;
          return row.pieces.map((piece, pi) => {
            const pw = piece.width_cm * SCALE;
            const ph = piece.height_cm * SCALE;
            // centrar pieza verticalmente dentro del espacio de la fila
            const pieceX = xStart;
            const pieceY = rowY + (rowH - ph) / 2;
            const cx = pieceX + pw / 2;
            const cy = pieceY + ph / 2;
            xStart += pw + gapPx;
            const colorIdx = uniquePaneIds.indexOf(piece.pane_id) % PANE_COLORS.length;
            const fill = PANE_COLORS[colorIdx] ?? "#94a3b8";
            return (
              <g key={`${ri}-${pi}`}>
                <rect x={pieceX} y={pieceY} width={pw} height={ph} rx={4} fill={fill} fillOpacity={0.88} />
                <text x={cx} y={cy - 10} textAnchor="middle" fontSize={18} fill="white" fontWeight="700">
                  {piece.label}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" fontSize={14} fill="white" fillOpacity={0.9}>
                  {piece.width_cm.toFixed(1)}×{piece.height_cm.toFixed(1)}cm
                </text>
                {piece.rotated && (
                  <text x={cx} y={cy + 30} textAnchor="middle" fontSize={12} fill="white" fillOpacity={0.75}>
                    [rotado]
                  </text>
                )}
              </g>
            );
          });
        })}
        <line x1={2} y1={14} x2={COORD_W + 2} y2={14} stroke="#94a3b8" strokeWidth={1} strokeDasharray="6,4" />
        <text x={(COORD_W + 4) / 2} y={11} textAnchor="middle" fontSize={12} fill="#64748b">
          ← {(rollWidthCm / 100).toFixed(2)} m →
        </text>
      </svg>
      <div className="flex flex-wrap gap-2 border-t border-[#e8ecf2] p-3">
        {rows.flatMap((row) =>
          row.pieces.map((piece, pi) => {
            const colorIdx = uniquePaneIds.indexOf(piece.pane_id) % PANE_COLORS.length;
            return (
              <span
                key={`leg-${piece.label}-${pi}`}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: PANE_COLORS[colorIdx] ?? "#94a3b8" }}
              >
                {piece.label}: {piece.width_cm.toFixed(1)}×{piece.height_cm.toFixed(1)}cm
                {piece.rotated ? " [rot]" : ""}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
