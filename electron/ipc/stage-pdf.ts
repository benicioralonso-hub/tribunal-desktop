/**
 * IPC: leer PDF local como base64 para el visor (sandbox-safe).
 */
import { ipcMain } from "electron";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { IPC } from "./channels";

export type ReadLocalPdfResult =
  | { ok: true; base64: string; mimeType: "application/pdf"; fileName: string }
  | { ok: false; error: string };

const MAX_PDF_BYTES = 40 * 1024 * 1024;

export async function readLocalPdfFile(
  absolutePath: string,
): Promise<ReadLocalPdfResult> {
  try {
    const resolved = await realpath(absolutePath);
    if (path.extname(resolved).toLowerCase() !== ".pdf") {
      return { ok: false, error: "Solo se permiten archivos PDF." };
    }
    const st = await stat(resolved);
    if (!st.isFile()) {
      return { ok: false, error: "La ruta no es un archivo." };
    }
    if (st.size > MAX_PDF_BYTES) {
      return { ok: false, error: "PDF demasiado grande para previsualizar." };
    }
    const buf = await readFile(resolved);
    return {
      ok: true,
      base64: buf.toString("base64"),
      mimeType: "application/pdf",
      fileName: path.basename(resolved),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function registerPdfViewerIpc(): void {
  ipcMain.handle(
    IPC.READ_LOCAL_PDF,
    async (_evt, absolutePath: string): Promise<ReadLocalPdfResult> => {
      if (!absolutePath || typeof absolutePath !== "string") {
        return { ok: false, error: "Ruta inválida." };
      }
      return readLocalPdfFile(absolutePath);
    },
  );
}
