/**
 * Generación automática del borrador manual post-mapeo
 * (equivalente a “Generar borrador manual” de la web, sin botón).
 * Tipificación estricta: canónico tipify + doble amonestación; resto → sin_tipificar.
 */

import { buildFalloHeader, finalizeDraft } from "./render-fallo";
import {
  buildManualFalloDraft,
  type ManualResolutionLine,
} from "./manual-fallo";
import { tipifyFromTipoEvento } from "./tipify-tipo-evento";
import type { FalloDraft, SanctionKind } from "./types";

export const WARNING_SIN_CASO = "Alerta: este informe no tiene caso";
export const WARNING_SIN_TIPIFICAR =
  "Requiere Tipificación Manual";

export type AutoDraftPerson = {
  person: string | null;
  club: string | null;
  role: string | null;
  /** Señal COMET: doble amonestación → Regla 12. */
  dobleAmonestacion?: boolean;
  /** Valor crudo de «Tipo de evento». */
  tipoEvento?: string | null;
  signals?: string[];
  partidos?: number;
  caseId?: string;
};

export type AutoDraftInput = {
  expediente: string | null;
  homeClub: string | null;
  awayClub: string | null;
  matchDate: string | null;
  competition: string | null;
  folderName?: string | null;
  /** Todos los infractores del partido (1 fallo, N resoluciones). */
  persons: AutoDraftPerson[];
  missingCaso?: boolean;
};

export type ResolvedTipify = {
  kind: SanctionKind;
  article: string;
  partidos: number;
  confidence: number;
  rationale: string;
  sinTipificar: boolean;
};

/**
 * Resuelve tipificación estricta:
 * 1) tipifyFromTipoEvento (frases canónicas)
 * 2) señal doble_amonestacion
 * 3) sin_tipificar
 */
export function resolvePersonTipify(p: AutoDraftPerson): ResolvedTipify {
  const fromEvento = tipifyFromTipoEvento(p.tipoEvento);
  if (fromEvento) {
    return { ...fromEvento, sinTipificar: false };
  }

  const doble =
    p.dobleAmonestacion ||
    Boolean(p.signals?.includes("doble_amonestacion"));
  if (doble) {
    return {
      kind: "doble_amonestacion",
      article: "Regla 12 del International Board. (doble amonestación)",
      partidos: 1,
      confidence: 92,
      rationale: "Señal de doble amonestación → Regla 12, 1 partido.",
      sinTipificar: false,
    };
  }

  return {
    kind: "otra",
    article: "",
    partidos: 0,
    confidence: 20,
    rationale: p.tipoEvento
      ? `Sin tipificación canónica para «${p.tipoEvento}».`
      : "Sin tipificación canónica (tipo de evento ausente o atípico).",
    sinTipificar: true,
  };
}

/** Borrador pendiente cuando hay informe sin caso. */
export function buildPendingSinCasoDraft(input: {
  expediente: string | null;
  homeClub: string | null;
  awayClub: string | null;
  matchDate: string | null;
  competition: string | null;
  folderName?: string | null;
}): FalloDraft {
  const header = buildFalloHeader({
    homeClub: input.homeClub,
    awayClub: input.awayClub,
    match: input.folderName,
    category: input.competition,
    divisionLabelOverride: undefined,
    matchDate: input.matchDate,
    expedienteNumber: input.expediente,
  });
  return finalizeDraft({
    header,
    confidence: 20,
    rationale: WARNING_SIN_CASO,
    redactorModel: "manual",
    items: [
      {
        kind: "otra",
        personName: "",
        role: "",
        club: "",
        bodyText: `[Pendiente] ${WARNING_SIN_CASO}. No se pudo redactar la resolución por falta de CASO disciplinario.`,
      },
    ],
  });
}

function buildSinTipificarDraft(input: AutoDraftInput): FalloDraft {
  const header = buildFalloHeader({
    homeClub: input.homeClub,
    awayClub: input.awayClub,
    match: input.folderName,
    category: input.competition,
    matchDate: input.matchDate,
    expedienteNumber: input.expediente,
  });

  const items = input.persons.map((p) => {
    const tip = resolvePersonTipify(p);
    if (!tip.sinTipificar) {
      // Mixed: tipified rows still get a proper resolution via manual builder later;
      // for shared draft we keep placeholders per unresolved person only.
      return null;
    }
    const person = p.person || "Infractor a identificar";
    const club = p.club || input.homeClub || "Club sin identificar";
    const role = p.role || "jugador";
    const eventoBit = p.tipoEvento
      ? ` Tipo de evento: «${p.tipoEvento}».`
      : "";
    return {
      kind: "otra" as const,
      personName: person,
      role,
      club,
      bodyText: `[Pendiente de tipificación manual] ${person} (${role}, ${club}).${eventoBit} Completar artículo y fechas de suspensión.`,
      sourceCaseKey: p.caseId,
    };
  });

  // If some persons tipified and some not, build hybrid via manual for tipified + otra for rest
  const resolved = input.persons.map((p) => ({
    person: p,
    tip: resolvePersonTipify(p),
  }));
  const anySin = resolved.some((r) => r.tip.sinTipificar);
  const allSin = resolved.every((r) => r.tip.sinTipificar);

  if (allSin) {
    return finalizeDraft({
      header,
      confidence: 25,
      rationale: WARNING_SIN_TIPIFICAR,
      redactorModel: "manual",
      status: "sin_tipificar",
      items: items.filter(Boolean) as Array<{
        kind: "otra";
        personName: string;
        role: string;
        club: string;
        bodyText: string;
        sourceCaseKey?: string;
      }>,
    });
  }

  if (anySin) {
    const resolutions: ManualResolutionLine[] = resolved.map(({ person: p, tip }) => {
      if (tip.sinTipificar) {
        const personName = p.person || "Infractor a identificar";
        const club = p.club || input.homeClub || "Club sin identificar";
        const role = p.role || "jugador";
        const eventoBit = p.tipoEvento
          ? ` Tipo de evento: «${p.tipoEvento}».`
          : "";
        return {
          kind: "otra" as const,
          personName,
          club,
          role,
          caseId: p.caseId,
          customText: `[Pendiente de tipificación manual] ${personName} (${role}, ${club}).${eventoBit} Completar artículo y fechas de suspensión.`,
        };
      }
      return {
        kind: tip.kind,
        personName: p.person || "",
        club: p.club || input.homeClub || "",
        role: p.role || "jugador",
        partidos: tip.partidos,
        article: tip.article,
        caseId: p.caseId,
      };
    });

    const draft = buildManualFalloDraft({
      homeClub: input.homeClub || "",
      awayClub: input.awayClub || "",
      expedienteNumber: input.expediente || undefined,
      matchDate: input.matchDate || undefined,
      category: input.competition || undefined,
      matchFolder: input.folderName || undefined,
      resolutions,
    });
    return { ...draft, status: "sin_tipificar", rationale: WARNING_SIN_TIPIFICAR };
  }

  // unreachable if called only when anySin
  return finalizeDraft({
    header,
    confidence: 25,
    rationale: WARNING_SIN_TIPIFICAR,
    redactorModel: "manual",
    status: "sin_tipificar",
    items: [],
  });
}

/**
 * Genera el fallo manual automáticamente tras el mapeo.
 * Tipificación estricta: canónico o doble amonestación; resto sin_tipificar.
 */
export function buildFalloDraft(input: AutoDraftInput): FalloDraft {
  if (input.missingCaso || input.persons.length === 0) {
    return buildPendingSinCasoDraft(input);
  }

  const resolved = input.persons.map((p) => ({
    person: p,
    tip: resolvePersonTipify(p),
  }));

  if (resolved.some((r) => r.tip.sinTipificar)) {
    return buildSinTipificarDraft(input);
  }

  const resolutions: ManualResolutionLine[] = resolved.map(({ person: p, tip }) => ({
    kind: tip.kind,
    personName: p.person || "",
    club: p.club || input.homeClub || "",
    role: p.role || "jugador",
    partidos: tip.partidos,
    article: tip.article,
    caseId: p.caseId,
  }));

  return buildManualFalloDraft({
    homeClub: input.homeClub || "",
    awayClub: input.awayClub || "",
    expedienteNumber: input.expediente || undefined,
    matchDate: input.matchDate || undefined,
    category: input.competition || undefined,
    matchFolder: input.folderName || undefined,
    resolutions,
  });
}

// Re-exports for callers that still import title helpers
export { buildFalloHeader } from "./render-fallo";
export { buildManualFalloDraft } from "./manual-fallo";
