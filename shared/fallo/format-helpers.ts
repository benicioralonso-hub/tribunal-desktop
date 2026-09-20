/**
 * Formato de clubs / expediente / disciplina para encabezado y cuerpo.
 * Subconjunto autocontenido de fallo-sanitize + tribunal-rules.
 */

import { formatClubName, formatMatchDate } from "../map/sanitize";

export { formatClubName, formatMatchDate };

export function formatExpediente(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = String(c).match(/(\d{2,6}(?:[./]\d+)?)/);
    if (!m) continue;
    const full = m[1]!;
    const base = full.split(/[./]/)[0]!;
    if (/^0+$/.test(base)) continue;
    if (/^00(0[1-9]|1[0-4])$/.test(base)) continue; // 0001–0014
    if (base.length <= 3 && !/[./]/.test(full) && Number(base) < 1000) continue;
    return full;
  }
  return null;
}

/** Etiqueta corta de disciplina/categoría para el encabezado. */
export function formatDivisionLabel(
  division?: string | null,
  category?: string | null,
): string | null {
  const blob = `${division || ""} ${category || ""}`.toLowerCase();
  if (!blob.trim()) return null;
  if (/hora|impreso|decisi[oó]n/i.test(blob)) return null;

  if (/futsal/i.test(blob)) {
    if (/femenino/i.test(blob)) return "Futsal Fem.";
    return "Futsal";
  }
  if (/proyecci[oó]n|reserva|\brva\.?\b/i.test(blob)) return "Rva.";
  if (/tercera\s*nacional|3ra\.?\s*nac/i.test(blob)) return "3ra.Nac.";
  if (/primera\s*nacional|1ra\.?\s*nac/i.test(blob)) return "1ra.Nac.";
  if (/primera\s*b|1ra\.?\s*b/i.test(blob)) return "1ra.B.";
  if (/tercera\s*b|3ra\.?\s*b/i.test(blob)) return "3ra.B.";
  if (/\b3ra\.?\b/i.test(blob)) return "3ra.";
  if (/\b4ta\.?\b/i.test(blob)) return "4ta.";
  if (/\b1ra\.?\b|\bprimera\b/i.test(blob)) return "1ra.";
  if (/copa\s*argentina/i.test(blob)) return "COPA ARGENTINA";

  const short = String(division || category || "").trim();
  if (short && short.length <= 24) return short;
  return null;
}

function titleCaseEveryWord(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const lower = word.toLocaleLowerCase("es-AR");
      return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1);
    })
    .join(" ");
}

/** Título: MAYÚSCULAS fuera de paréntesis. */
export function formatClubTitle(name: string): string {
  const trimmed = name.trim().replace(/^club\s+/i, "");
  return trimmed.replace(/[^(]+|\([^)]*\)/g, (seg) => {
    if (seg.startsWith("(") && seg.endsWith(")")) {
      const inner = seg.slice(1, -1).trim();
      return `(${titleCaseEveryWord(inner)})`;
    }
    return seg.toLocaleUpperCase("es-AR");
  });
}

export function formatoClubEnCuerpo(nombreClub: string): string {
  const name = nombreClub.trim();
  if (!name) return "del Club";
  if (/\b(?:F\.?\s*C\.?|A\.?\s*C\.?)\b/i.test(name)) return `del ${name}`;
  if (/\bclub\b/i.test(name)) return `del ${name}`;
  return `del Club ${name}`;
}

export function formatClubBody(name: string): string {
  const trimmed = name.trim();
  const geo = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (geo) {
    const base = geo[1]!.trim();
    const loc = geo[2]!.trim();
    if (/\b(?:F\.?\s*C\.?|A\.?\s*C\.?)\b/i.test(base) || /\bclub\b/i.test(base)) {
      return `del ${base} de ${loc}`;
    }
    return `del Club ${base} de ${loc}`;
  }
  return formatoClubEnCuerpo(trimmed);
}
