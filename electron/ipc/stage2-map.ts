import { ipcMain, BrowserWindow } from "electron";
import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { IPC } from "./channels";
import { PdfMapPool } from "../workers/worker-pool";
import {
  isInformesFolderName,
} from "../../shared/map/match-link-local";
import { isMatchFolderName } from "../../shared/map/sanitize";
import {
  buildMappedCases,
  type PdfHit,
} from "../../shared/map/build-mapped-cases";
import type {
  MapFolderResult,
  MapProgressEvent,
} from "../../shared/map/types";

export type { PdfHit };
export { buildMappedCases };

/**
 * Recorrido estricto:
 * Boletín → categorías / divisiones → carpeta de partido.
 * Solo indexa PDFs bajo carpetas de partido + Informes/.
 * Ignora PDFs sueltos en nodos intermedios (p.ej. 4TA/).
 */
export async function walkBoletinPdfs(root: string): Promise<PdfHit[]> {
  const out: PdfHit[] = [];
  const visited = new Set<string>();

  async function walk(dir: string): Promise<void> {
    let real: string;
    try {
      real = await realpath(dir);
    } catch {
      real = dir;
    }
    if (visited.has(real)) return;
    visited.add(real);

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const base = path.basename(dir);
    const isInformes = isInformesFolderName(base);
    const isMatch = isMatchFolderName(base);

    const subdirs: string[] = [];
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          const st = await stat(absolutePath);
          if (st.isDirectory()) {
            subdirs.push(absolutePath);
            continue;
          }
          if (
            st.isFile() &&
            path.extname(entry.name).toLowerCase() === ".pdf" &&
            (isMatch || isInformes)
          ) {
            out.push({
              absolutePath,
              folderPath: dir,
              folderName: base,
              fromInformes: isInformes,
            });
          }
        } catch {
          /* ignore broken links */
        }
        continue;
      }
      if (entry.isDirectory()) {
        subdirs.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (path.extname(entry.name).toLowerCase() !== ".pdf") continue;

      if (isMatch || isInformes) {
        out.push({
          absolutePath,
          folderPath: dir,
          folderName: base,
          fromInformes: isInformes,
        });
      }
    }

    if (subdirs.length > 0) {
      await Promise.all(subdirs.map((d) => walk(d)));
    }
  }

  await walk(root);
  return out;
}

function broadcastProgress(ev: MapProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.MAP_PROGRESS, ev);
  }
}

function shortName(filePath?: string): string {
  if (!filePath) return "";
  return path.basename(filePath);
}

export function registerStage2Ipc(): void {
  ipcMain.handle(
    IPC.MAP_BOLETIN_FOLDER,
    async (_evt, folderPath: unknown): Promise<MapFolderResult> => {
      if (typeof folderPath !== "string" || !path.isAbsolute(folderPath)) {
        return { ok: false, error: "Ruta de carpeta inválida" };
      }

      const started = Date.now();

      broadcastProgress({
        phase: "scanning",
        done: 0,
        total: 0,
        label: "Escaneando carpeta del boletín…",
      });

      const pdfs = await walkBoletinPdfs(folderPath);
      if (pdfs.length === 0) {
        return {
          ok: false,
          error:
            "No se encontraron PDFs en carpetas de partido (ni en Informes/)",
        };
      }

      const pool = new PdfMapPool();
      try {
        broadcastProgress({
          phase: "starting",
          done: 0,
          total: pdfs.length,
          label: `Arrancando ${pool.size} workers locales…`,
          workerCount: pool.size,
        });

        const jobs = pdfs.map((p) => ({
          id: randomUUID(),
          pdfPath: p.absolutePath,
          folderName: p.folderName,
        }));

        const results = await pool.mapAll(jobs, (info) => {
          const name = shortName(info.currentPath);
          const label = info.started
            ? `Extrayendo · ${name}`
            : `Listo ${info.done}/${info.total} · ${name}`;
          broadcastProgress({
            phase: "mapping",
            done: info.done,
            total: info.total,
            label,
            currentPath: info.currentPath,
            workerCount: pool.size,
          });
        });

        broadcastProgress({
          phase: "merging",
          done: pdfs.length,
          total: pdfs.length,
          label: "Emparejando CASO + INFORME y redactando borradores…",
          workerCount: pool.size,
        });

        const byPath = new Map(
          results.map((r) => [r.pdfPath || "", r] as const),
        );

        const cases = buildMappedCases(pdfs, byPath);
        const durationMs = Date.now() - started;

        broadcastProgress({
          phase: "done",
          done: pdfs.length,
          total: pdfs.length,
          label: `Mapeo listo en ${(durationMs / 1000).toFixed(1)}s`,
          workerCount: pool.size,
        });

        return {
          ok: true,
          cases,
          pdfCount: pdfs.length,
          durationMs,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        await pool.destroy();
      }
    },
  );
}
