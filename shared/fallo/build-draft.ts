/**
 * Generación automática del borrador manual post-mapeo
 * (equivalente a “Generar borrador manual” de la web, sin botón).
 */

import { buildFalloHeader, finalizeDraft } from "./render-fallo";
import {
  buildManualFalloDraft,
  type ManualResolutionLine,
} from "./manual-fallo";
import type { FalloDraft, SanctionKind } from "./types";

export const WARNING_SIN_CASO = "Alerta: este informe no tiene caso";

export type AutoDraftPerson = {
  person: string | null;
  club: string | null;
  role: string | null;
  /** Señal COMET: doble amonestación → Regla 12. */
  dobleAmonestacion?: boolean;
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

function inferKind(p: AutoDraftPerson): SanctionKind {
  if (p.dobleAmonestacion) return "doble_amonestacion";
  return "suspension_partidos";
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

/**
 * Genera el fallo manual automáticamente tras el mapeo.
 * Mismo motor que la web: encabezado + cuerpos tipificados.
 */
export function buildFalloDraft(input: AutoDraftInput): FalloDraft {
  if (input.missingCaso || input.persons.length === 0) {
    return buildPendingSinCasoDraft(input);
  }

  const resolutions: ManualResolutionLine[] = input.persons.map((p) => {
    const kind = inferKind(p);
    return {
      kind,
      personName: p.person || "",
      club: p.club || input.homeClub || "",
      role: p.role || "jugador",
      partidos: kind === "doble_amonestacion" ? 1 : p.partidos ?? 1,
      caseId: p.caseId,
    };
  });

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
