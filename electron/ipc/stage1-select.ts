import { dialog, ipcMain } from "electron";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import {
  IPC,
  type BoletinFileEntry,
  type SelectBoletinResult,
} from "./channels";

async function listBoletinTree(root: string): Promise<BoletinFileEntry[]> {
  const out: BoletinFileEntry[] = [];
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    const isDirectory = entry.isDirectory();
    const info = isDirectory ? null : await stat(absolutePath);
    out.push({
      name: entry.name,
      absolutePath,
      size: info?.size ?? 0,
      isDirectory,
      ext: isDirectory ? "" : path.extname(entry.name).toLowerCase(),
    });
  }

  return out.sort((a, b) => {
    const rank = (e: BoletinFileEntry) =>
      e.ext === ".pdf" ? 0 : e.isDirectory ? 1 : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name, "es");
  });
}

export function registerStage1Ipc(): void {
  ipcMain.handle(
    IPC.SELECT_BOLETIN_FOLDER,
    async (): Promise<SelectBoletinResult> => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "Seleccionar carpeta del boletín",
        defaultPath: process.platform === "win32" ? "G:\\" : undefined,
        properties: ["openDirectory", "dontAddToRecent"],
      });

      if (canceled || filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      const folderPath = filePaths[0];
      try {
        const files = await listBoletinTree(folderPath);
        return { ok: true, folderPath, files };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "No se pudo listar la carpeta",
        };
      }
    },
  );

  ipcMain.handle(
    IPC.LIST_BOLETIN_FILES,
    async (_evt, folderPath: unknown): Promise<SelectBoletinResult> => {
      if (typeof folderPath !== "string" || !path.isAbsolute(folderPath)) {
        return { ok: false, error: "Ruta inválida" };
      }
      try {
        const files = await listBoletinTree(folderPath);
        return { ok: true, folderPath, files };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "No se pudo listar la carpeta",
        };
      }
    },
  );
}
