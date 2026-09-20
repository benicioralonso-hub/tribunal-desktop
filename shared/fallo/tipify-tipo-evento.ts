/**
 * Tipificación rigurosa desde el campo PDF COMET «Tipo de evento:».
 * Solo mapea frases canónicas; duda o exclusión → null (predeterminado).
 * Port 1:1 de tribunal-app `lib/tipify-tipo-evento.ts`.
 */

import type { SanctionKind } from "./types";

export type TipoEventoTipify = {
  kind: SanctionKind;
  article: string;
  partidos: number;
  confidence: number;
  rationale: string;
};

/** Normalización determinística para comparación canónica. */
export function normalizeTipoEventoKey(raw: string | null | undefined): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/[“”„"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

type CanonRule = {
  /** Forma canónica ya normalizada (o prefijo para la regla larga). */
  canon: string;
  /** Si true, match por prefijo + tokens obligatorios (solo Malograr…). */
  prefix?: boolean;
  requireTokens?: RegExp[];
  kind: SanctionKind;
  article: string;
  partidos: number;
  rationale: string;
};

const EXCLUSIONS: string[] = [
  normalizeTipoEventoKey(
    "Tarjeta roja - Emplear lenguaje ofensivo, grosero u obsceno y/o gestos de la misma naturaleza",
  ),
];

const RULES: CanonRule[] = [
  {
    canon: normalizeTipoEventoKey(
      "Expulsión - Conducta inadecuada dentro del banco",
    ),
    kind: "suspension_con_multa_ve",
    article: "Art. 13 1. c) del Código Disciplinario",
    partidos: 1,
    rationale:
      "Tipo de evento: Expulsión — conducta inadecuada en el banco → Art. 13 1. c), 1 fecha + multa.",
  },
  {
    canon: normalizeTipoEventoKey(
      "Tarjeta roja - Malograr una oportunidad manifiesta de gol",
    ),
    prefix: true,
    // COMET / código histórico a veces omiten la "i" (manifesta).
    requireTokens: [/oportunidad\s+manif[i]?esta/, /tiro\s+libre|penal/],
    kind: "suspension_partidos",
    article: "Art. 13 1. a) del Código Disciplinario",
    partidos: 1,
    rationale:
      "Tipo de evento: Tarjeta roja — malograr ocasión manifiesta → Art. 13 1. a), 1 fecha.",
  },
  {
    canon: normalizeTipoEventoKey(
      "Tarjeta amarilla - Retardar la reanudación del juego",
    ),
    kind: "suspension_con_multa_ve",
    article: "Art. 12 3. del Código Disciplinario",
    partidos: 1,
    rationale:
      "Tipo de evento: Tarjeta amarilla — retardar reanudación → Art. 12 3., 1 fecha + multa.",
  },
  {
    canon: normalizeTipoEventoKey("Tarjeta roja - Juego brusco grave"),
    kind: "suspension_partidos",
    article: "Art. 13 1. e) del Código Disciplinario",
    partidos: 2,
    rationale:
      "Tipo de evento: Tarjeta roja — juego brusco grave → Art. 13 1. e), 2 fechas.",
  },
  {
    canon: normalizeTipoEventoKey(
      "Tarjeta amarilla - Infracciones permanentes de Las Reglas de Juego",
    ),
    kind: "suspension_partidos",
    article: "Regla 12 del International Board",
    partidos: 1,
    rationale:
      "Tipo de evento: Tarjeta amarilla — infracciones permanentes → Regla 12 IB, 1 fecha.",
  },
  {
    canon: normalizeTipoEventoKey("Tarjeta roja - Conducta Violenta"),
    kind: "suspension_partidos",
    article: "Art. 13 1. h) del Código Disciplinario",
    partidos: 3,
    rationale:
      "Tipo de evento: Tarjeta roja — conducta violenta → Art. 13 1. h), 3 fechas.",
  },
  {
    canon: normalizeTipoEventoKey("Tarjeta amarilla - Conducta Antideportiva"),
    kind: "suspension_partidos",
    article: "Regla 12 del International Board",
    partidos: 1,
    rationale:
      "Tipo de evento: Tarjeta amarilla — conducta antideportiva → Regla 12 IB, 1 fecha.",
  },
];

/** Frases canónicas exportadas para tests. */
export const TIPO_EVENTO_CANON_PHRASES = RULES.map((r) => r.canon);
export const TIPO_EVENTO_EXCLUSIONS = EXCLUSIONS;

/** Artículos sugeridos en el selector de tipificación manual. */
export const MANUAL_TIPIFY_ARTICLES: string[] = [
  "Art. 13 1. a) del Código Disciplinario",
  "Art. 13 1. c) del Código Disciplinario",
  "Art. 13 1. e) del Código Disciplinario",
  "Art. 13 1. h) del Código Disciplinario",
  "Art. 12 3. del Código Disciplinario",
  "Art. 12 3. a) del Código Disciplinario",
  "Regla 12 del International Board",
  "Regla 12 del International Board. (doble amonestación)",
];

function matchesRule(key: string, rule: CanonRule): boolean {
  if (rule.prefix) {
    if (!key.startsWith(rule.canon)) return false;
    if (rule.requireTokens?.length) {
      return rule.requireTokens.every((re) => re.test(key));
    }
    return true;
  }
  return key === rule.canon;
}

/**
 * Tipifica desde el valor crudo de «Tipo de evento» del PDF.
 * null = sin mapeo (predeterminado / exclusión / desconocido).
 */
export function tipifyFromTipoEvento(
  tipoEvento: string | null | undefined,
): TipoEventoTipify | null {
  const key = normalizeTipoEventoKey(tipoEvento);
  if (!key || key.length < 4) return null;

  for (const excl of EXCLUSIONS) {
    if (key === excl || key.startsWith(excl)) return null;
  }

  for (const rule of RULES) {
    if (!matchesRule(key, rule)) continue;
    return {
      kind: rule.kind,
      article: rule.article,
      partidos: rule.partidos,
      confidence: 96,
      rationale: rule.rationale,
    };
  }

  return null;
}
