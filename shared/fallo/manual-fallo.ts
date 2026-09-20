/**
 * Redacción manual de fallos (sin IA).
 * Port de tribunal-app `lib/manual-fallo.ts`.
 */

import {
  buildFalloHeader,
  finalizeDraft,
  joinArticlesLabel,
} from "./render-fallo";
import type { FalloDraft, SanctionKind } from "./types";

const MANUAL_FIXED_ARTICLES: Partial<Record<SanctionKind, string>> = {
  dar_vista: "Art. 36 del Código Disciplinario.-",
  multa_club: "Art. 12 3. a) del Código Disciplinario.-",
  multa_club_plazo: "Art. 12 3. a) del Código Disciplinario.-",
  medida_provisional: "Arts. 47 y 48 del Código Disciplinario.-",
  medida_autorizada: "Art. 13 8. del Código Disciplinario.-",
  suspension_provisional: "Art. 13 8. del Código Disciplinario.-",
  dar_por_cumplida: "Art. 25 del Código Disciplinario.-",
  doble_amonestacion: "Regla 12 del International Board. (doble amonestación).-",
};

export function isTextOnlyKind(kind: SanctionKind): boolean {
  return (
    kind === "archive_sin_tramite" ||
    kind === "continuan_actuaciones" ||
    kind === "remitir_estadios" ||
    kind === "remitir_equidad" ||
    kind === "aprueba_medida_autorizada" ||
    kind === "otra"
  );
}

export function isClubOnlyKind(kind: SanctionKind): boolean {
  return (
    kind === "multa_club" ||
    kind === "multa_club_plazo" ||
    kind === "dar_vista"
  );
}

export function kindAllowsArticlePicker(kind: SanctionKind): boolean {
  return (
    kind === "suspension_partidos" ||
    kind === "suspension_con_multa_ve" ||
    kind === "doble_amonestacion"
  );
}

export function kindNeedsPartidos(kind: SanctionKind): boolean {
  return (
    kind === "suspension_partidos" ||
    kind === "suspension_con_multa_ve" ||
    kind === "doble_amonestacion"
  );
}

export function defaultArticleForKind(kind: SanctionKind): string {
  const fixed = MANUAL_FIXED_ARTICLES[kind];
  if (kind === "doble_amonestacion") {
    return "Art. 13 1. a) del Código Disciplinario";
  }
  if (fixed) return fixed.trim().replace(/\.-\s*$/, "");
  if (kind === "suspension_con_multa_ve") {
    return "Art. 13 1. c) del Código Disciplinario";
  }
  if (kind === "suspension_partidos") {
    return "Art. 13 1. e) del Código Disciplinario";
  }
  return "";
}

function normalizeArticlesList(
  articles: string[] | undefined,
  article: string | undefined,
): string[] {
  const fromList = Array.isArray(articles) ? articles : [];
  const raw =
    fromList.length > 0 ? fromList : article?.trim() ? [article] : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const v = String(item || "").trim();
    if (!v) continue;
    const key = v.toLocaleLowerCase("es-AR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= 2) break;
  }
  return out;
}

export type ManualResolutionLine = {
  kind: SanctionKind;
  personName: string;
  club: string;
  role: string;
  caseId?: string;
  partidos?: number;
  multaVe?: number;
  multaEntrada?: number;
  multaPesos?: number;
  article?: string;
  articles?: string[];
  opponentClub?: string;
  boletinNumber?: string;
  boletinSuffix?: string;
  boletinDate?: string;
  customText?: string;
  bodyText?: string;
};

export type ManualFalloInput = {
  homeClub: string;
  awayClub: string;
  personName?: string;
  club?: string;
  role?: string;
  kind?: SanctionKind;
  partidos?: number;
  multaVe?: number;
  article?: string;
  expedienteNumber?: string;
  divisionLabel?: string;
  matchDate?: string;
  category?: string;
  matchFolder?: string;
  resolutions?: ManualResolutionLine[];
};

function normalizeKind(kind: SanctionKind): SanctionKind {
  return kind === "suspension_provisional" ? "medida_autorizada" : kind;
}

function normalizeLine(
  input: ManualResolutionLine,
  homeClub: string,
): Omit<ManualResolutionLine, "personName" | "club" | "role"> & {
  personName: string;
  club: string;
  role: string;
  partidos?: number;
  multaVe?: number;
  multaPesos?: number;
  article?: string;
  articles?: string[];
} {
  const kind = normalizeKind(input.kind);
  const isClubSanction =
    kind === "multa_club" ||
    kind === "multa_club_plazo" ||
    kind === "dar_vista";
  const isTextOnly =
    kind === "archive_sin_tramite" ||
    kind === "continuan_actuaciones" ||
    kind === "remitir_estadios" ||
    kind === "remitir_equidad" ||
    kind === "aprueba_medida_autorizada" ||
    kind === "otra";
  const personName = input.personName.replace(/\s+/g, " ").trim();
  const club = input.club.trim() || homeClub;
  const role = isClubSanction
    ? "club"
    : (input.role || "").trim() || (isTextOnly ? "" : "jugador");
  const partidos =
    kind === "doble_amonestacion"
      ? 1
      : input.partidos && input.partidos > 0
        ? input.partidos
        : 1;
  const multaVe =
    kind === "multa_club" || kind === "multa_club_plazo"
      ? input.multaVe ?? 50
      : kind === "suspension_con_multa_ve"
        ? input.multaVe ?? 21
        : undefined;
  const multaPesos =
    kind === "suspension_con_multa_ve"
      ? input.multaPesos ??
        (input.multaEntrada && multaVe
          ? input.multaEntrada * multaVe
          : undefined)
      : undefined;
  let articles = normalizeArticlesList(input.articles, input.article);
  if (kind === "doble_amonestacion") {
    if (articles.length === 0) {
      articles = [
        defaultArticleForKind("doble_amonestacion"),
        "Regla 12 del International Board",
      ].filter(Boolean);
    } else if (
      articles.length === 1 &&
      !/international\s*board|regla\s*12/i.test(articles[0]!)
    ) {
      articles = [...articles, "Regla 12 del International Board"];
    }
  } else if (!isTextOnly && articles.length === 0) {
    const fallback = defaultArticleForKind(kind);
    if (fallback) articles = [fallback];
  }
  const article = joinArticlesLabel(articles) || undefined;
  const customText = String(input.customText || "").trim();
  return {
    kind,
    personName: isTextOnly
      ? ""
      : isClubSanction
        ? club || "Club sin identificar"
        : personName || "Infractor a identificar",
    role: isTextOnly ? "" : role,
    club: isTextOnly ? club || "" : club || "Club sin identificar",
    partidos:
      kind === "suspension_partidos" ||
      kind === "suspension_con_multa_ve" ||
      kind === "doble_amonestacion"
        ? partidos
        : undefined,
    multaVe,
    multaPesos,
    article,
    articles: articles.length ? articles : undefined,
    opponentClub: kind === "medida_autorizada" ? input.opponentClub : undefined,
    boletinNumber:
      kind === "aprueba_medida_autorizada" ? input.boletinNumber : undefined,
    boletinSuffix:
      kind === "aprueba_medida_autorizada" ? input.boletinSuffix : undefined,
    boletinDate:
      kind === "aprueba_medida_autorizada" ? input.boletinDate : undefined,
    bodyText: kind === "otra" ? customText : undefined,
  };
}

/** Arma un borrador de fallo sin IA, con plantillas clásicas (1 o N resoluciones). */
export function buildManualFalloDraft(input: ManualFalloInput): FalloDraft {
  const homeClub = input.homeClub.trim();
  const awayClub = input.awayClub.trim();

  const lines: ManualResolutionLine[] =
    input.resolutions && input.resolutions.length > 0
      ? input.resolutions
      : [
          {
            kind: input.kind || "suspension_partidos",
            personName: input.personName || "",
            club: input.club || "",
            role: input.role || "jugador",
            partidos: input.partidos,
            multaVe: input.multaVe,
            article: input.article,
          },
        ];

  const items = lines.map((line) => normalizeLine(line, homeClub));

  const header = buildFalloHeader({
    homeClub,
    awayClub,
    match: input.matchFolder,
    category: input.category,
    divisionLabelOverride: input.divisionLabel,
    matchDate: input.matchDate,
    expedienteNumber: input.expedienteNumber,
  });

  return finalizeDraft({
    header,
    confidence: Math.round(
      items.reduce((acc, it) => {
        let s = 40;
        if (it.personName) s += 20;
        if (it.club) s += 25;
        if (it.role && it.role !== "jugador") s += 10;
        else if (it.role) s += 5;
        return acc + Math.min(95, s);
      }, 0) / Math.max(1, items.length),
    ),
    rationale: "Borrador manual",
    redactorModel: "manual",
    items: items.map((item, idx) => ({
      kind: item.kind,
      personName: item.personName,
      role: item.role,
      club: item.club,
      partidos: item.partidos,
      multaVe: item.multaVe,
      multaPesos: item.multaPesos,
      article: item.article,
      articles: item.articles,
      opponentClub: item.opponentClub,
      boletinNumber: item.boletinNumber,
      boletinSuffix: item.boletinSuffix,
      boletinDate: item.boletinDate,
      bodyText: item.bodyText,
      sourceCaseKey: lines[idx]?.caseId || undefined,
    })),
  });
}
