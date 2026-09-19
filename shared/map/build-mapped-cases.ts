/**
 * Emparejado CASO/INFORME + borrador — puro (sin Electron).
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
import { mergeCasoInforme, type MapFacts } from "./map-from-text";
import { isInformesFolderName, matchLeafFromName } from "./match-link-local";
import { isMatchFolderName, parseMatchFolderName } from "./sanitize";
import {
  buildFalloDraft,
  WARNING_SIN_CASO,
} from "../fallo/build-draft";
import type { MappedCase } from "./types";

export type PdfHit = {
  absolutePath: string;
  folderPath: string;
  folderName: string;
  /** true si el PDF vive bajo Informes/ (no bajo carpeta de partido). */
  fromInformes?: boolean;
};

/** Resultado mínimo del worker de mapeo (ok/error). */
export type MapWorkerResult =
  | { ok: true; pdfPath?: string; facts: MapFacts; textLen?: number }
  | { ok: false; pdfPath?: string; error: string };

type ClassifiedHit = PdfHit & {
  kind: "caso" | "informe" | "otro";
  leaf: string;
};

function classifyHit(
  hit: PdfHit,
  res: MapWorkerResult | undefined,
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
    casoRes?: MapWorkerResult;
    infRes?: MapWorkerResult;
    warning?: string | null;
  },
): void {
  const folderMeta = parseMatchFolderName(opts.folderName);
  const facts = mergeCasoInforme(
    opts.casoRes?.ok ? opts.casoRes.facts : null,
    opts.infRes?.ok ? opts.infRes.facts : null,
    opts.folderName,
  );
  const missingCaso = !opts.caso && Boolean(opts.informe);
  const warning =
    opts.warning ?? (missingCaso ? WARNING_SIN_CASO : null);
  const expediente = folderMeta.expedienteHint;

  const draft = buildFalloDraft({
    expediente,
    homeClub: facts.homeClub,
    awayClub: facts.awayClub,
    matchDate: facts.matchDate,
    competition: facts.competition,
    person: facts.person,
    role: facts.role,
    club: facts.club,
    missingCaso,
  });

  cases.push({
    id: randomUUID(),
    folderPath: opts.folderPath,
    folderName: opts.folderName,
    casoPdfPath: opts.caso?.absolutePath ?? null,
    informePdfPath: opts.informe?.absolutePath ?? null,
    expediente,
    homeClub: facts.homeClub,
    awayClub: facts.awayClub,
    person: facts.person,
    club: facts.club,
    role: facts.role,
    matchDate: facts.matchDate,
    competition: facts.competition,
    confidence: facts.confidence,
    engine: "classical",
    warning,
    draft,
    error:
      opts.casoRes && !opts.casoRes.ok
        ? opts.casoRes.error
        : opts.infRes && !opts.infRes.ok
          ? opts.infRes.error
          : undefined,
  });
}

function casesPushError(
  cases: MappedCase[],
  hit: PdfHit,
  error: string,
): void {
  const folderMeta = parseMatchFolderName(hit.folderName);
  cases.push({
    id: randomUUID(),
    folderPath: hit.folderPath,
    folderName: hit.folderName,
    casoPdfPath: hit.absolutePath,
    informePdfPath: null,
    expediente: folderMeta.expedienteHint,
    homeClub: folderMeta.homeClub,
    awayClub: folderMeta.awayClub,
    person: null,
    club: null,
    role: null,
    matchDate: null,
    competition: null,
    confidence: 0,
    engine: "classical",
    warning: null,
    draft: null,
    error,
  });
}

/**
 * Agrupa exclusivamente por carpeta de partido.
 * 1 informe compartido entre N casos del mismo partido.
 * Informe sin caso → warning.
 */
export function buildMappedCases(
  pdfs: PdfHit[],
  byPath: Map<string, MapWorkerResult>,
): MappedCase[] {
  const cases: MappedCase[] = [];
  const classified = pdfs.map((hit) =>
    classifyHit(hit, byPath.get(hit.absolutePath)),
  );

  const usedInformes = new Set<string>();

  const informesByLeaf = new Map<string, ClassifiedHit[]>();
  for (const hit of classified) {
    if (hit.kind !== "informe") continue;
    if (!hit.fromInformes && !isInformesFolderName(hit.folderName)) continue;
    const list = informesByLeaf.get(hit.leaf) ?? [];
    list.push(hit);
    informesByLeaf.set(hit.leaf, list);
  }

  const byFolder = new Map<string, ClassifiedHit[]>();
  for (const hit of classified) {
    if (hit.fromInformes || isInformesFolderName(hit.folderName)) continue;
    if (!isMatchFolderName(hit.folderName)) continue;
    const list = byFolder.get(hit.folderPath) ?? [];
    list.push(hit);
    byFolder.set(hit.folderPath, list);
  }

  for (const [folder, hits] of byFolder) {
    const folderName = path.basename(folder);
    const casoHits = hits.filter((h) => h.kind === "caso");
    const informeHits = hits.filter((h) => h.kind === "informe");
    const otros = hits.filter((h) => h.kind === "otro");

    const folderLeaf = matchLeafFromName(folderName);
    const crossInformes = (informesByLeaf.get(folderLeaf) ?? []).filter(
      (inf) => !usedInformes.has(inf.absolutePath),
    );
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

    const sharedInforme: ClassifiedHit | null =
      informeHits[0] ?? crossInformes[0] ?? null;
    if (sharedInforme) usedInformes.add(sharedInforme.absolutePath);
    for (const inf of informeHits) usedInformes.add(inf.absolutePath);

    const anchors =
      casoHits.length > 0 ? casoHits : otros.length > 0 ? otros : [];

    if (anchors.length === 0) {
      if (sharedInforme) {
        pushMappedCase(cases, {
          folderPath: folder,
          folderName,
          caso: null,
          informe: sharedInforme,
          infRes: byPath.get(sharedInforme.absolutePath),
          warning: WARNING_SIN_CASO,
        });
      }
      continue;
    }

    for (const caso of anchors) {
      pushMappedCase(cases, {
        folderPath: folder,
        folderName,
        caso,
        informe: sharedInforme,
        casoRes: byPath.get(caso.absolutePath),
        infRes: sharedInforme
          ? byPath.get(sharedInforme.absolutePath)
          : undefined,
      });
    }
  }

  for (const hit of classified) {
    if (hit.kind !== "informe") continue;
    if (!hit.fromInformes && !isInformesFolderName(hit.folderName)) continue;
    if (usedInformes.has(hit.absolutePath)) continue;
    pushMappedCase(cases, {
      folderPath: hit.folderPath,
      folderName: hit.leaf || hit.folderName,
      caso: null,
      informe: hit,
      infRes: byPath.get(hit.absolutePath),
      warning: WARNING_SIN_CASO,
    });
  }

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
