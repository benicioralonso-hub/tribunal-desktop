/**
 * Extracción de texto PDF con unpdf (Uint8Array puro, sin Buffer).
 */

const MAX_BYTES = 900 * 1024;

function toPureUint8Array(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return bytes.buffer instanceof ArrayBuffer
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : Uint8Array.from(bytes);
  }
  return new Uint8Array(bytes);
}

function joinText(text: string | string[] | null | undefined): string {
  if (Array.isArray(text)) return text.map((p) => String(p ?? "")).join("\n");
  return String(text ?? "");
}

export async function extractTextFromPdf(
  bytes: ArrayBuffer | Uint8Array,
): Promise<string> {
  const source = toPureUint8Array(bytes);
  const capped =
    source.byteLength > MAX_BYTES ? source.subarray(0, MAX_BYTES) : source;

  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(capped.slice());
  try {
    const { text } = await extractText(pdf, { mergePages: true });
    return joinText(text).replace(/\u0000/g, " ").slice(0, 16000);
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
        /* isolate */
      }
    }
  }
}
