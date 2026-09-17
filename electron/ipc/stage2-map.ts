import { ipcMain, BrowserWindow } from "electron";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { IPC } from "./channels";
import { PdfMapPool } from "../workers/worker-pool";
import { mergeCasoInforme } from "../../shared/map/map-from-text";
import type { MappedCase, MapFolderResult } from "../../shared/map/types";

type PdfHit = {
  absolutePath: string;
  folderPath: string;
  folderName: string;
};

async function walkPdfs(root: string): Promise<PdfHit[]> {
  const out: PdfHit[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (path.extname(entry.name).toLowerCase() !== ".pdf") continue;
      out.push({
        absolutePath,
        folderPath: dir,
        folderName: path.basename(dir),
      });
    }
  }

  await walk(root);
  return out;
}

function broadcastProgress(
  done: number,
  total: number,
  currentPath?: string,
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.MAP_PROGRESS, { done, total, currentPath });
  }
}

export function registerStage2Ipc(): void {
  ipcMain.handle(
    IPC.MAP_BOLETIN_FOLDER,
    async (_evt, folderPath: unknown): Promise<MapFolderResult> => {
      if (typeof folderPath !== "string" || !path.isAbsolute(folderPath)) {
        return { ok: false, error: "Ruta de carpeta inválida" };
      }

      const started = Date.now();
      const pdfs = await walkPdfs(folderPath);
      if (pdfs.length === 0) {
        return {
          ok: false,
          error: "No se encontraron PDFs en la carpeta seleccionada",
        };
      }

      const pool = new PdfMapPool();
      try {
        const jobs = pdfs.map((p) => ({
          id: randomUUID(),
          pdfPath: p.absolutePath,
          folderName: p.folderName,
        }));

        broadcastProgress(0, jobs.length);
        const results = await pool.mapAll(jobs, (done, total, currentPath) => {
          broadcastProgress(done, total, currentPath);
        });

        const byPath = new Map(
          results.map((r) => [r.pdfPath || "", r] as const),
        );

        // Agrupar por carpeta de partido: CASO + INFORME
        const byFolder = new Map<string, PdfHit[]>();
        for (const hit of pdfs) {
          const list = byFolder.get(hit.folderPath) ?? [];
          list.push(hit);
          byFolder.set(hit.folderPath, list);
        }

        const cases: MappedCase[] = [];
        for (const [folder, hits] of byFolder) {
          const folderName = path.basename(folder);
          const casoHits: PdfHit[] = [];
          const informeHits: PdfHit[] = [];
          const otros: PdfHit[] = [];

          for (const hit of hits) {
            const res = byPath.get(hit.absolutePath);
            if (!res || !res.ok) {
              casosPushError(cases, hit, res && !res.ok ? res.error : "sin resultado");
              continue;
            }
            if (res.facts.kind === "caso") casoHits.push(hit);
            else if (res.facts.kind === "informe") informeHits.push(hit);
            else {
              // Clasificar por nombre de archivo si el texto fue pobre
              const name = path.basename(hit.absolutePath).toLowerCase();
              if (name.includes("informe")) informeHits.push(hit);
              else if (name.includes("caso")) casoHits.push(hit);
              else otros.push(hit);
            }
          }

          const pairs =
            casoHits.length > 0
              ? casoHits
              : otros.length > 0
                ? otros
                : [];

          if (pairs.length === 0 && informeHits.length > 0) {
            // Solo informes: un registro por informe
            for (const inf of informeHits) {
              const infRes = byPath.get(inf.absolutePath);
              const facts =
                infRes && infRes.ok
                  ? mergeCasoInforme(null, infRes.facts, folderName)
                  : mergeCasoInforme(null, null, folderName);
              cases.push({
                id: randomUUID(),
                folderPath: folder,
                folderName,
                casoPdfPath: null,
                informePdfPath: inf.absolutePath,
                homeClub: facts.homeClub,
                awayClub: facts.awayClub,
                person: facts.person,
                club: facts.club,
                role: facts.role,
                matchDate: facts.matchDate,
                competition: facts.competition,
                confidence: facts.confidence,
                engine: "classical",
              });
            }
            continue;
          }

          for (let i = 0; i < pairs.length; i += 1) {
            const caso = pairs[i];
            const informe = informeHits[Math.min(i, informeHits.length - 1)];
            const casoRes = byPath.get(caso.absolutePath);
            const infRes = informe
              ? byPath.get(informe.absolutePath)
              : undefined;
            const facts = mergeCasoInforme(
              casoRes && casoRes.ok ? casoRes.facts : null,
              infRes && infRes.ok ? infRes.facts : null,
              folderName,
            );
            cases.push({
              id: randomUUID(),
              folderPath: folder,
              folderName,
              casoPdfPath: caso.absolutePath,
              informePdfPath: informe?.absolutePath ?? null,
              homeClub: facts.homeClub,
              awayClub: facts.awayClub,
              person: facts.person,
              club: facts.club,
              role: facts.role,
              matchDate: facts.matchDate,
              competition: facts.competition,
              confidence: facts.confidence,
              engine: "classical",
              error:
                casoRes && !casoRes.ok ? casoRes.error : undefined,
            });
          }
        }

        cases.sort((a, b) =>
          a.folderName.localeCompare(b.folderName, "es"),
        );

        return {
          ok: true,
          cases,
          pdfCount: pdfs.length,
          durationMs: Date.now() - started,
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

function casosPushError(
  cases: MappedCase[],
  hit: PdfHit,
  error: string,
): void {
  cases.push({
    id: randomUUID(),
    folderPath: hit.folderPath,
    folderName: hit.folderName,
    casoPdfPath: hit.absolutePath,
    informePdfPath: null,
    homeClub: null,
    awayClub: null,
    person: null,
    club: null,
    role: null,
    matchDate: null,
    competition: null,
    confidence: 0,
    engine: "classical",
    error,
  });
}
