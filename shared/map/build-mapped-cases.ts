/**
 * Emparejado CASO/INFORME + borrador manual automático — puro (sin Electron).
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
import { mergeCasoInforme, type MapFacts } from "./map-from-text";
import { isInformesFolderName, matchLeafFromName } from "./match-link-local";
import { isMatchFolderName, parseMatchFolderName } from "./sanitize";
import { categoryRootFromFolderPath } from "./category-root";
import {
  buildFalloDraft,
  WARNING_SIN_CASO,
} from "../fallo/build-draft";
import type { FalloDraft } from "../fallo/types";
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

function buildSharedDraft(opts: {
  folderName: string;
  expediente: string | null;
  homeClub: string | null;
  awayClub: string | null;
  matchDate: string | null;
  competition: string | null;
  persons: Array<{
    person: string | null;
    club: string | null;
    role: string | null;
    signals?: string[];
    tipoEvento?: string | null;
    caseId?: string;
  }>;
  missingCaso: boolean;
}): FalloDraft {
  return buildFalloDraft({
    expediente: opts.expediente,
    homeClub: opts.homeClub,
    awayClub: opts.awayClub,
    matchDate: opts.matchDate,
    competition: opts.competition,
    folderName: opts.folderName,
    missingCaso: opts.missingCaso,
    persons: opts.persons.map((p) => ({
      person: p.person,
      club: p.club,
      role: p.role,
      caseId: p.caseId,
      tipoEvento: p.tipoEvento,
      signals: p.signals,
      dobleAmonestacion: Boolean(
        p.signals?.includes("doble_amonestacion"),
      ),
    })),
  });
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
    /** Borrador compartido del partido (1 doc, N resoluciones). */
    sharedDraft?: FalloDraft | null;
  },
): MappedCase {
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

  const draft =
    opts.sharedDraft ??
    buildSharedDraft({
      folderName: opts.folderName,
      expediente,
      homeClub: facts.homeClub,
      awayClub: facts.awayClub,
      matchDate: facts.matchDate,
      competition: facts.competition,
      missingCaso,
      persons: missingCaso
        ? []
        : [
            {
              person: facts.person,
              club: facts.club,
              role: facts.role,
              signals: facts.signals,
              tipoEvento: facts.tipoEvento,
              caseId: opts.caso?.absolutePath,
            },
          ],
    });

  const mapped: MappedCase = {
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
    tipoEvento: facts.tipoEvento ?? null,
    categoryRoot: categoryRootFromFolderPath(opts.folderPath),
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
  };
  cases.push(mapped);
  return mapped;
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
    tipoEvento: null,
    categoryRoot: categoryRootFromFolderPath(hit.folderPath),
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
 * Borrador manual automático: 1 fallo por partido (N resoluciones).
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

    const folderMeta = parseMatchFolderName(folderName);
    const infFacts =
      sharedInforme && byPath.get(sharedInforme.absolutePath)?.ok
        ? (byPath.get(sharedInforme.absolutePath) as Extract<
            MapWorkerResult,
            { ok: true }
          >).facts
        : null;

    if (anchors.length === 0) {
      if (sharedInforme) {
        const merged = mergeCasoInforme(null, infFacts, folderName);
        const draft = buildSharedDraft({
          folderName,
          expediente: folderMeta.expedienteHint,
          homeClub: merged.homeClub,
          awayClub: merged.awayClub,
          matchDate: merged.matchDate,
          competition: merged.competition,
          missingCaso: true,
          persons: [],
        });
        pushMappedCase(cases, {
          folderPath: folder,
          folderName,
          caso: null,
          informe: sharedInforme,
          infRes: byPath.get(sharedInforme.absolutePath),
          warning: WARNING_SIN_CASO,
          sharedDraft: draft,
        });
      }
      continue;
    }

    // Hechos por caso + merge con informe para clubs/fecha
    const personRows = anchors.map((caso) => {
      const casoRes = byPath.get(caso.absolutePath);
      const merged = mergeCasoInforme(
        casoRes?.ok ? casoRes.facts : null,
        infFacts,
        folderName,
      );
      return { caso, casoRes, merged };
    });

    const matchHome =
      personRows.find((r) => r.merged.homeClub)?.merged.homeClub ??
      folderMeta.homeClub;
    const matchAway =
      personRows.find((r) => r.merged.awayClub)?.merged.awayClub ??
      folderMeta.awayClub;
    const matchDate =
      personRows.find((r) => r.merged.matchDate)?.merged.matchDate ?? null;
    const competition =
      personRows.find((r) => r.merged.competition)?.merged.competition ??
      null;

    const sharedDraft = buildSharedDraft({
      folderName,
      expediente: folderMeta.expedienteHint,
      homeClub: matchHome,
      awayClub: matchAway,
      matchDate,
      competition,
      missingCaso: false,
      persons: personRows.map((r) => ({
        person: r.merged.person,
        club: r.merged.club,
        role: r.merged.role,
        signals: r.merged.signals,
        tipoEvento: r.merged.tipoEvento,
        caseId: r.caso.absolutePath,
      })),
    });

    for (const row of personRows) {
      pushMappedCase(cases, {
        folderPath: folder,
        folderName,
        caso: row.caso,
        informe: sharedInforme,
        casoRes: row.casoRes,
        infRes: sharedInforme
          ? byPath.get(sharedInforme.absolutePath)
          : undefined,
        sharedDraft,
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
