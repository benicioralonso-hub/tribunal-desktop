/**
 * Extracción PDF liviana (title/ASCII/heurísticas) — port de tribunal-app
 * `lib/pdf-extract-lite.ts`, sin dependencias de Drive/Workers Free.
 */

/** Copia a Uint8Array real: Buffer instanceof Uint8Array === true, pero pdfjs lo rechaza. */
export function toPureUint8Array(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes).slice();
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice();
}

/** Normaliza acentos para match robusto (Decisión / Decision, etc.). */
export function foldAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0000/g, " ");
}

export function looksLikeDocumentText(text: string): boolean {
  const sample = foldAccents(text).slice(0, 5000);
  if (
    /%PDF-\d|\/Type\s*\/(?:Catalog|Pages|Page)\b|endobj|endstream|FlateDecode/i.test(
      sample,
    )
  ) {
    return false;
  }
  if (
    /informe\s+del\s+partido|decision\s+de\s+caso|disciplinary\s+case|oficiales\s+de\s+partido|tipo\s+de\s+infractor|alineaciones|numero\s+de\s+partido|comet\s*-\s*asociacion/i.test(
      sample,
    )
  ) {
    return true;
  }
  const letters = (sample.match(/[A-Za-z]{3,}/g) ?? []).length;
  const junk = (
    sample.match(/%PDF|endstream|FlateDecode|ColorSpace|XObject|endobj/g) ?? []
  ).length;
  return letters >= 12 && junk < 3;
}

export function extractPdfInfoTitle(data: Uint8Array): string | null {
  const head = new TextDecoder("latin1").decode(
    data.slice(0, Math.min(data.length, 120_000)),
  );
  const paren = head.match(/\/Title\s*\((?:\\.|[^\\)]){2,200}\)/);
  if (paren) {
    const inner = paren[0].replace(/^\/Title\s*\(/, "").replace(/\)$/, "");
    return inner.replace(/\\([nrt\\()])/g, (_, ch: string) => {
      if (ch === "n") return "\n";
      if (ch === "r") return "\r";
      if (ch === "t") return "\t";
      return ch;
    });
  }
  const hex = head.match(/\/Title\s*<([0-9A-Fa-f]+)>/);
  if (hex?.[1]) {
    try {
      const raw = hex[1];
      const bytes = new Uint8Array(raw.length / 2);
      for (let i = 0; i < raw.length; i += 2) {
        bytes[i / 2] = Number.parseInt(raw.slice(i, i + 2), 16);
      }
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        let out = "";
        for (let i = 2; i + 1 < bytes.length; i += 2) {
          out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
        }
        return out.trim() || null;
      }
      return new TextDecoder("utf-8").decode(bytes).trim() || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function extractAsciiStringsFromPdf(data: Uint8Array): string {
  const chunks: string[] = [];
  let current = "";
  for (let i = 0; i < data.length; i += 1) {
    const code = data[i]!;
    const printable =
      (code >= 32 && code <= 126) ||
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 192 && code <= 255);
    if (printable) {
      current += String.fromCharCode(code);
    } else if (current.length >= 5) {
      chunks.push(current);
      current = "";
    } else {
      current = "";
    }
  }
  if (current.length >= 5) chunks.push(current);
  return chunks.join("\n");
}

export function preferCometWindow(joined: string): string {
  const lower = foldAccents(joined).toLowerCase();
  const markers = [
    "informe del partido",
    "decision de caso disciplinario",
    "disciplinary case",
    "tipo de infractor",
    "oficiales de partido",
    "alineaciones",
  ];
  let best = -1;
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx >= 0 && (best < 0 || idx < best)) best = idx;
  }
  if (best >= 0) {
    return joined.slice(Math.max(0, best - 100), best + 7000);
  }
  return joined.slice(0, 8000);
}

/** Tope para unpdf en workers: PDFs enteros disparan OOM. */
export const PROPOSE_PDF_MAX_BYTES = 900 * 1024;

export const COMET_TITLE_RE =
  /informe\s+del?\s+partido|decision\s+de\s+caso|caso\s+disciplinario|disciplinary\s+case|match\s+report/i;

/**
 * Conserva encabezado (fecha/clubes) + ventana de “Tarjetas rojas” (2ª hoja).
 */
export function trimPdfTextForRemap(text: string, maxTotal = 22000): string {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  if (!normalized.trim()) return "";
  if (normalized.length <= maxTotal) return normalized;

  const fold = foldAccents(normalized);
  const redIdx = fold.search(/tarjetas?\s+rojas?\b/i);
  const fechaIdx = fold.search(/fecha\s+y\s+hora/i);
  const compIdx = fold.search(/competicion\s*:/i);

  const redBudget =
    redIdx >= 0 ? Math.min(4500, Math.max(1800, Math.floor(maxTotal * 0.5))) : 0;
  const headBudget = Math.min(
    redIdx >= 0 ? 5500 : 8000,
    Math.max(2500, maxTotal - redBudget - 200),
  );

  const parts: string[] = [normalized.slice(0, headBudget)];

  const pushWindow = (idx: number, before: number, after: number) => {
    if (idx < 0) return;
    const markerProbe = normalized.slice(
      idx,
      Math.min(normalized.length, idx + 28),
    );
    if (markerProbe && parts.some((p) => p.includes(markerProbe))) return;
    const start = Math.max(0, idx - before);
    const end = Math.min(normalized.length, idx + after);
    parts.push(normalized.slice(start, end));
  };

  pushWindow(fechaIdx, 60, 160);
  pushWindow(redIdx, 80, redBudget || 4500);
  pushWindow(compIdx, 20, 200);

  const joined = parts.join("\n\n");
  if (joined.length <= maxTotal) return joined;
  if (redIdx >= 0) {
    const redPart = normalized.slice(
      Math.max(0, redIdx - 40),
      Math.min(normalized.length, redIdx + (redBudget || 4000)),
    );
    const head = normalized.slice(
      0,
      Math.max(1500, maxTotal - redPart.length - 4),
    );
    return `${head}\n\n${redPart}`.slice(0, maxTotal);
  }
  return joined.slice(0, maxTotal);
}
