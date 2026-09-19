/**
 * Extracción de texto PDF con unpdf — pipeline estilo
 * `extractTextFromPdfForRemap` de tribunal-app (fallbacks + trim inteligente).
 */

import {
  extractAsciiStringsFromPdf,
  extractPdfInfoTitle,
  looksLikeDocumentText,
  preferCometWindow,
  PROPOSE_PDF_MAX_BYTES,
  toPureUint8Array,
  trimPdfTextForRemap,
} from "./extract-lite";

/**
 * unpdf/pdfjs reusa heap: hay que destruir el proxy para que el 2º PDF
 * del mismo worker no copie el texto del 1º.
 */
async function extractUnpdfText(
  bytes: Uint8Array,
  mergePages: boolean,
): Promise<string | string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes.slice());
  try {
    const { text } = await extractText(pdf, { mergePages });
    return text;
  } finally {
    const doc = pdf as {
      destroy?: () => Promise<unknown> | unknown;
      cleanup?: (keep?: boolean) => Promise<unknown> | unknown;
    };
    try {
      await Promise.resolve(doc.destroy?.());
    } catch {
      try {
        await Promise.resolve(doc.cleanup?.(false));
      } catch {
        /* isolate reuse */
      }
    }
  }
}

function joinUnpdfText(text: string | string[] | null | undefined): string {
  if (Array.isArray(text)) return text.map((p) => String(p ?? "")).join("\n");
  return String(text ?? "");
}

/**
 * Extracción para mapeo Stage 2: todas las páginas útiles
 * (fecha + tarjetas rojas), con fallbacks title/ASCII.
 */
export async function extractTextFromPdf(
  bytes: ArrayBuffer | Uint8Array,
): Promise<string> {
  const source = toPureUint8Array(bytes);
  const capped =
    source.byteLength > PROPOSE_PDF_MAX_BYTES
      ? source.subarray(0, PROPOSE_PDF_MAX_BYTES)
      : source;
  const title = extractPdfInfoTitle(capped);

  let unpdfText = "";
  try {
    unpdfText = joinUnpdfText(await extractUnpdfText(capped, true));
  } catch {
    /* caemos a ASCII */
  }

  const withTitle =
    title && unpdfText && !unpdfText.includes(title)
      ? `${title}\n${unpdfText}`
      : unpdfText || title || "";

  if (withTitle.trim().length >= 40 && looksLikeDocumentText(withTitle)) {
    return trimPdfTextForRemap(withTitle);
  }

  if (withTitle.trim().length >= 40) {
    return trimPdfTextForRemap(withTitle);
  }

  const ascii = preferCometWindow(
    [title ?? "", extractAsciiStringsFromPdf(capped)].join("\n"),
  );
  if (ascii.trim().length >= 20 && looksLikeDocumentText(ascii)) {
    return trimPdfTextForRemap(ascii);
  }
  if (ascii.trim().length >= 20) {
    return trimPdfTextForRemap(ascii);
  }

  return trimPdfTextForRemap(withTitle || (title || "").trim());
}
