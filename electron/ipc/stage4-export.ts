import { ipcMain, dialog, BrowserWindow } from "electron";
import { writeFile } from "node:fs/promises";
import { IPC, type ExportDocxResult } from "./channels";
import { buildBoletinDocxBuffer } from "../../shared/docx/build-boletin-docx";
import type { AuditedCase } from "../../shared/ai/audit-types";

function isAuditedCase(value: unknown): value is AuditedCase {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.folderName === "string";
}

export function registerStage4Ipc(): void {
  ipcMain.handle(
    IPC.EXPORT_BOLETIN_DOCX,
    async (_evt, casesRaw: unknown): Promise<ExportDocxResult> => {
      if (!Array.isArray(casesRaw) || casesRaw.length === 0) {
        return { ok: false, error: "No hay casos para exportar" };
      }
      if (!casesRaw.every(isAuditedCase)) {
        return { ok: false, error: "Payload de casos inválido" };
      }

      const cases = casesRaw as AuditedCase[];
      const win = BrowserWindow.getFocusedWindow();
      const save = await dialog.showSaveDialog(
        win ?? undefined,
        {
          title: "Exportar boletín DOCX",
          defaultPath: `boletin-tribunal-${new Date().toISOString().slice(0, 10)}.docx`,
          filters: [{ name: "Word DOCX", extensions: ["docx"] }],
        },
      );

      if (save.canceled || !save.filePath) {
        return { ok: false, canceled: true };
      }

      const filePath = save.filePath.endsWith(".docx")
        ? save.filePath
        : `${save.filePath}.docx`;

      const started = Date.now();
      try {
        const buffer = await buildBoletinDocxBuffer(cases);
        await writeFile(filePath, buffer);
        return {
          ok: true,
          filePath,
          durationMs: Date.now() - started,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
}
