import { ipcMain, BrowserWindow } from "electron";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { IPC } from "./channels";
import { PdfMapPool } from "../workers/worker-pool";
import { mergeCasoInforme } from "../../shared/map/map-from-text";
import {
  isInformesFolderName,
  matchLeafFromName,
} from "../../shared/map/match-link-local";
import type {
  MappedCase,
  MapFolderResult,
  MapProgressEvent,
} from "../../shared/map/types";
import type { WorkerResult } from "../workers/pdf-map.worker";

type PdfHit = {
  absolutePath: string;
  folderPath: string;
  folderName: string;
};

type ClassifiedHit = PdfHit & {
  kind: "caso" | "informe" | "otro";
  leaf: string;
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
    const subdirs: string[] = [];
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        subdirs.push(absolutePath);
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
    // Recorrido paralelo: usa I/O y CPU local al máximo
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

function classifyHit(
  hit: PdfHit,
  res: WorkerResult | undefined,
): ClassifiedHit {
  const fileName = path.basename(hit.absolutePath);
  let kind: "caso" | "informe" | "otro" = "otro";
  if (res?.ok) {
    kind = res.facts.kind;
  }
  if (kind === "otro") {
    const name = fileName.toLowerCase();
    if (name.includes("informe")) kind = "informe";
    else if (name.includes("caso")) kind = "caso";
  }
  const leaf = matchLeafFromName(hit.folderName, fileName);
  return { ...hit, kind, leaf };
}

function pushMappedCase(
  cases: MappedCase[],
  opts: {
    folderPath: string;
    folderName: string;
    caso: PdfHit | null;
    informe: PdfHit | null;
    casoRes?: WorkerResult;
    infRes?: WorkerResult;
  },
): void {
  const facts = mergeCasoInforme(
    opts.casoRes?.ok ? opts.casoRes.facts : null,
    opts.infRes?.ok ? opts.infRes.facts : null,
    opts.folderName,
  );
  cases.push({
    id: randomUUID(),
    folderPath: opts.folderPath,
    folderName: opts.folderName,
    casoPdfPath: opts.caso?.absolutePath ?? null,
    informePdfPath: opts.informe?.absolutePath ?? null,
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
      opts.casoRes && !opts.casoRes.ok
        ? opts.casoRes.error
        : opts.infRes && !opts.infRes.ok
          ? opts.infRes.error
          : undefined,
  });
}

/**
 * Agrupa CASO + INFORME por carpeta de partido.
 * Si el INFORME vive bajo Informes/, lo empareja por leaf de partido.
 */
function buildMappedCases(
  pdfs: PdfHit[],
  byPath: Map<string, WorkerResult>,
): MappedCase[] {
  const cases: MappedCase[] = [];
  const classified = pdfs.map((hit) =>
    classifyHit(hit, byPath.get(hit.absolutePath)),
  );

  const usedInformes = new Set<string>();

  // Informes bajo carpeta Informes/ indexados por leaf
  const informesByLeaf = new Map<string, ClassifiedHit[]>();
  for (const hit of classified) {
    if (hit.kind !== "informe") continue;
    if (!isInformesFolderName(hit.folderName)) continue;
    const list = informesByLeaf.get(hit.leaf) ?? [];
    list.push(hit);
    informesByLeaf.set(hit.leaf, list);
  }

  // Agrupar por carpeta padre (excluyendo Informes/ como carpeta de partido)
  const byFolder = new Map<string, ClassifiedHit[]>();
  for (const hit of classified) {
    if (isInformesFolderName(hit.folderName) && hit.kind === "informe") {
      continue; // se emparejan después vía leaf
    }
    const list = byFolder.get(hit.folderPath) ?? [];
    list.push(hit);
    byFolder.set(hit.folderPath, list);
  }

  for (const [folder, hits] of byFolder) {
    const folderName = path.basename(folder);
    const casoHits = hits.filter((h) => h.kind === "caso");
    const informeHits = hits.filter((h) => h.kind === "informe");
    const otros = hits.filter((h) => h.kind === "otro");

    // Cross-folder: informes en Informes/ con mismo leaf
    const folderLeaf = matchLeafFromName(folderName);
    const crossInformes = (informesByLeaf.get(folderLeaf) ?? []).filter(
      (inf) => !usedInformes.has(inf.absolutePath),
    );
    // También buscar por leaf de cada caso
    for (const caso of casoHits) {
      for (const inf of informesByLeaf.get(caso.leaf) ?? []) {
        if (
          !usedInformes.has(inf.absolutePath) &&
          !crossInformes.some((x) => x.absolutePath === inf.absolutePath)
        ) {
          crossInformes.push(inf);
        }
      }
    }

    const allInformes = [...informeHits, ...crossInformes];

    const pairs =
      casoHits.length > 0 ? casoHits : otros.length > 0 ? otros : [];

    if (pairs.length === 0 && allInformes.length > 0) {
      for (const inf of allInformes) {
        usedInformes.add(inf.absolutePath);
        pushMappedCase(cases, {
          folderPath: folder,
          folderName,
          caso: null,
          informe: inf,
          infRes: byPath.get(inf.absolutePath),
        });
      }
      continue;
    }

    for (let i = 0; i < pairs.length; i += 1) {
      const caso = pairs[i]!;
      const informe = allInformes[Math.min(i, Math.max(0, allInformes.length - 1))];
      if (informe) usedInformes.add(informe.absolutePath);
      pushMappedCase(cases, {
        folderPath: folder,
        folderName,
        caso,
        informe: informe ?? null,
        casoRes: byPath.get(caso.absolutePath),
        infRes: informe ? byPath.get(informe.absolutePath) : undefined,
      });
    }
  }

  // Informes huérfanos bajo Informes/ sin CASO emparejado
  for (const hit of classified) {
    if (hit.kind !== "informe") continue;
    if (!isInformesFolderName(hit.folderName)) continue;
    if (usedInformes.has(hit.absolutePath)) continue;
    pushMappedCase(cases, {
      folderPath: hit.folderPath,
      folderName: hit.leaf || hit.folderName,
      caso: null,
      informe: hit,
      infRes: byPath.get(hit.absolutePath),
    });
  }

  // PDFs con error de worker que no entraron en ningún grupo
  for (const hit of pdfs) {
    const res = byPath.get(hit.absolutePath);
    if (res && !res.ok) {
      const already = cases.some(
        (c) =>
          c.casoPdfPath === hit.absolutePath ||
          c.informePdfPath === hit.absolutePath,
      );
      if (!already) {
        casesPushError(cases, hit, res.error);
      }
    }
  }

  cases.sort((a, b) => a.folderName.localeCompare(b.folderName, "es"));
  return cases;
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

      const pdfs = await walkPdfs(folderPath);
      if (pdfs.length === 0) {
        return {
          ok: false,
          error: "No se encontraron PDFs en la carpeta seleccionada",
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
          label: "Emparejando CASO + INFORME…",
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

function casesPushError(
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
