/**
 * Render de encabezado + cuerpos de resolución (modo manual).
 * Port de tribunal-app `lib/render-fallo.ts` (subset autocontenido).
 */

import {
  formatClubBody,
  formatClubName,
  formatClubTitle,
  formatDivisionLabel,
  formatExpediente,
  formatMatchDate,
} from "./format-helpers";
import { ensurePartidosEnLetras, partidosLabel } from "./partidos-en-letras";
import { normalizarCargo, roleAl } from "./manual-roles";
import type { FalloDraft, ResolutionItem, SanctionKind } from "./types";

function stripArticleCloser(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\.-\s*$/, "")
    .replace(/\.\s*$/, "")
    .trim();
}

function isInternationalBoardArticle(article: string): boolean {
  return /international\s*board|regla\s*12/i.test(article);
}

export function formatRegla12Closing(article: string): string {
  const stripped = stripArticleCloser(article)
    .replace(/\s*\(doble amonestaci[oó]n\)\s*\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
  const core = stripped || "Regla 12 del International Board";
  return `${core}. (doble amonestación).-`;
}

export function formatArticleClosing(
  article: string | undefined,
  fallback: string,
): string {
  const raw = (article || fallback).trim();
  if (!raw) {
    return /\.-\s*$/.test(fallback) ? fallback.trim() : `${fallback.trim()}.-`;
  }
  if (isInternationalBoardArticle(raw)) {
    return formatRegla12Closing(raw);
  }
  if (/\.-\s*$/.test(raw)) return raw.replace(/\s+$/, "");
  if (/\.\s*$/.test(raw)) return `${raw.replace(/\.\s*$/, "")}.-`;
  return `${raw}.-`;
}

export function ensureRegla12ClosingInText(text: string): string {
  return String(text || "").replace(
    /Regla\s*12\s+del\s+International\s+Board\.?(?:\s*\(doble amonestaci[oó]n\))?\.?-?/gi,
    "Regla 12 del International Board. (doble amonestación).-",
  );
}

function extractCodigoDisciplinarioRef(article: string): string | null {
  const cleaned = stripArticleCloser(article);
  const match = cleaned.match(
    /^arts?\.\s*(.+?)\s+del\s+c[oó]digo\s+disciplinario\b/i,
  );
  return match ? match[1]!.trim() : null;
}

function normalizeRegla12Label(article: string): string {
  return stripArticleCloser(article)
    .replace(/\s*\(doble amonestaci[oó]n\)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function joinArticlesLabel(articles: string[]): string {
  const list = articles
    .map((a) => stripArticleCloser(a))
    .filter(Boolean)
    .slice(0, 2);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;

  const [first, second] = list as [string, string];
  const firstIb = isInternationalBoardArticle(first);
  const secondIb = isInternationalBoardArticle(second);
  const firstRef = extractCodigoDisciplinarioRef(first);
  const secondRef = extractCodigoDisciplinarioRef(second);

  if (firstRef && secondRef && !firstIb && !secondIb) {
    return `Arts. ${firstRef} y ${secondRef} del Código Disciplinario`;
  }

  if ((firstRef && secondIb) || (secondRef && firstIb)) {
    const codigo = firstRef ? first : second;
    const regla = firstIb ? first : second;
    const codigoNorm = stripArticleCloser(codigo).replace(/^Arts\./i, "Art.");
    const reglaNorm = normalizeRegla12Label(regla);
    return `${codigoNorm} y ${reglaNorm}`;
  }

  return `${first} y ${second}`;
}

export const SANCTION_KIND_LABEL: Record<SanctionKind, string> = {
  suspension_partidos: "Suspensión por partidos",
  suspension_con_multa_ve: "Suspensión + multa v.e.",
  multa_club: "Multa a club",
  multa_club_plazo: "Multa a club con plazo de pago",
  dar_vista: "Dar vista",
  medida_provisional: "Medida provisional",
  medida_autorizada: "Medida autorizada",
  suspension_provisional: "Medida autorizada",
  dar_por_cumplida: "Dar por cumplida",
  doble_amonestacion: "Doble amonestación (Regla 12)",
  archive_sin_tramite: "Sin más trámite, archívese",
  continuan_actuaciones: "Continúan las actuaciones",
  remitir_estadios: "Remitir a Comisión de Estadios",
  remitir_equidad: "Remitir a Equidad y Género",
  aprueba_medida_autorizada: "Se aprueba la medida autorizada",
  otra: "Texto libre",
};

const MONTHS_ES_TITLE = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function formatBoletinFechaLarga(value: string | undefined): string {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const day = String(Number(iso[3]));
    const month = MONTHS_ES_TITLE[Number(iso[2]) - 1];
    if (month) return `${day} de ${month} de ${iso[1]}`;
  }
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = String(Number(dmy[1]));
    const month = MONTHS_ES_TITLE[Number(dmy[2]) - 1];
    if (month) return `${day} de ${month} de ${dmy[3]}`;
  }
  return raw;
}

export function formatApruebaMedidaAutorizada(input: {
  boletinNumber?: string;
  boletinSuffix?: string;
  boletinDate?: string;
}): string {
  const num = String(input.boletinNumber || "").trim() || "…";
  const suffix = String(input.boletinSuffix || "").trim();
  const fecha = formatBoletinFechaLarga(input.boletinDate) || "…";
  const boletin = suffix ? `Boletín ${num} ${suffix}` : `Boletín ${num}`;
  return `Se aprueba la medida autorizada en el ${boletin} del día ${fecha}.-`;
}

function clubBitForSentence(clubBit: string): string {
  return String(clubBit || "").replace(/\.\s*$/, "");
}

export function buildResolutionBody(
  item: Omit<ResolutionItem, "order" | "bodyText"> & { bodyText?: string },
): string {
  if (item.bodyText) {
    const club =
      formatClubName(item.club || "") || String(item.club || "").trim();
    const replaced = String(item.bodyText).replace(/\{\s*CLUB\s*\}/gi, club);
    return ensurePartidosEnLetras(replaced);
  }

  const role = normalizarCargo(item.role || "jugador").toLowerCase();
  const clubBit = formatClubBody(item.club);
  const person = item.personName.trim();
  const alRole = roleAl(role);
  const resolveArticle = (entry: {
    article?: string;
    articles?: string[];
  }): string | undefined => {
    const list = (
      entry.articles?.length
        ? entry.articles
        : entry.article?.trim()
          ? [entry.article]
          : []
    )
      .map((a) => String(a || "").trim())
      .filter(Boolean)
      .slice(0, 2);
    if (list.length === 0) return undefined;
    return joinArticlesLabel(list) || undefined;
  };

  const closeArticle = (article: string | undefined, fallback: string) =>
    formatArticleClosing(article, fallback);

  const itemArticle = resolveArticle(item);
  const clubSentence = clubBitForSentence(clubBit);
  const opponentBit = item.opponentClub
    ? clubBitForSentence(formatClubBody(item.opponentClub))
    : "del club rival";

  switch (item.kind) {
    case "doble_amonestacion":
      return `Se suspende por un partido ${alRole} ${person}, ${clubSentence}. ${closeArticle(itemArticle, "Regla 12 del International Board")}`;
    case "dar_vista":
      return `Se da vista por el término de cinco días contados desde la fecha de esta resolución, ${clubBit.replace(/^del\s+/i, "al ")}, debiendo tomar conocimiento y contestar dentro de ese plazo. ${closeArticle(itemArticle, "Art. 36 del Código Disciplinario")}`;
    case "multa_club": {
      const ve = item.multaVe ?? 50;
      return `Se multa ${clubBit.replace(/^del\s+/i, "al ")} en v.e. ${ve}. ${closeArticle(itemArticle, "Art. 12 3. a) del Código Disciplinario")}`;
    }
    case "multa_club_plazo": {
      const ve = item.multaVe ?? 50;
      return `Se multa ${clubBit.replace(/^del\s+/i, "al ")} en v.e. ${ve}. La misma deberá ser abonada dentro del plazo de diez (10) días hábiles contados a partir de la notificación de la presente resolución, debiendo acreditarse su pago ante este Tribunal. El incumplimiento de dicha obligación podrá dar lugar a la imposición de sanciones más gravosas, según lo previsto en el citado cuerpo normativo. ${closeArticle(itemArticle, "Art. 12 3. a) del Código Disciplinario")}`;
    }
    case "dar_por_cumplida":
      return `Se le da por cumplida la sanción ${alRole} ${person}, ${clubSentence}. ${closeArticle(itemArticle, "Art. 25 del Código Disciplinario")}`;
    case "medida_provisional":
      return `Se suspende provisionalmente y se autoriza a formular su defensa por escrito dentro del plazo reglamentario, ${alRole} ${person}, ${clubSentence}. ${closeArticle(itemArticle, "Arts. 47 y 48 del Código Disciplinario")}`;
    case "archive_sin_tramite":
      return "Sin más trámite, archívese el expediente.-";
    case "continuan_actuaciones":
      return "Continúan las actuaciones según su estado.-";
    case "remitir_estadios":
      return "Remítase copia del informe del árbitro, a la Comisión Especial de Estadios, a sus efectos.-";
    case "remitir_equidad":
      return "Remítase copia del informe del árbitro al Departamento de Equidad y Género, a sus efectos.-";
    case "aprueba_medida_autorizada":
      return formatApruebaMedidaAutorizada(item);
    case "otra": {
      const raw = String(item.bodyText || "").trim();
      const club =
        formatClubName(item.club || "") || String(item.club || "").trim();
      const replaced = raw.replace(/\{\s*CLUB\s*\}/gi, club);
      return ensurePartidosEnLetras(replaced || "…");
    }
    case "medida_autorizada":
    case "suspension_provisional": {
      const art = closeArticle(
        itemArticle,
        "Art. 13 8. del Código Disciplinario",
      ).replace(/\.-\s*$/, "");
      return `Se autoriza ${alRole} ${person}, ${clubBit}, a formular su defensa por escrito antes de la próxima Sesión del Tribunal. ${art} (habilitado para actuar contra su similar ${opponentBit}).-`;
    }
    case "suspension_con_multa_ve": {
      const partidos = item.partidos ?? 1;
      const ve = item.multaVe ?? 21;
      const pesos = item.multaPesos;
      const pesosBit =
        pesos != null && pesos > 0
          ? ` ($${Math.round(pesos).toLocaleString("es-AR")})`
          : "";
      return `Se suspende por ${partidosLabel(partidos)} o se le multa en v.e. ${ve}${pesosBit}, ${alRole} ${person}, ${clubSentence}. ${closeArticle(itemArticle, "Art. 13 del Código Disciplinario")}`;
    }
    case "suspension_partidos":
    default: {
      const partidos = item.partidos ?? 1;
      return `Se suspende por ${partidosLabel(partidos)} ${alRole} ${person}, ${clubSentence}. ${closeArticle(itemArticle, "Art. 13 del Código Disciplinario")}`;
    }
  }
}

export function sortResolutionItems<
  T extends { partidos?: number; role?: string },
>(items: T[]): T[] {
  const isPlayer = (role?: string) => /jugador/i.test(role || "");
  return [...items].sort((a, b) => {
    const pa = a.partidos ?? 0;
    const pb = b.partidos ?? 0;
    if (pb !== pa) return pb - pa;
    const aPlayer = isPlayer(a.role) ? 0 : 1;
    const bPlayer = isPlayer(b.role) ? 0 : 1;
    return aPlayer - bPlayer;
  });
}

export function buildFalloHeader(input: {
  homeClub?: string | null;
  awayClub?: string | null;
  match?: string | null;
  category?: string | null;
  division?: string | null;
  divisionLabelOverride?: string | null;
  matchDate?: string | null;
  sessionDate?: string | null;
  expedienteNumber?: string | null;
  id?: string;
}): string {
  let local = (input.homeClub || "").trim();
  let visitante = (input.awayClub || "").trim();
  if (
    (!local || !visitante || /^local$/i.test(local) || /^visitante$/i.test(visitante)) &&
    input.match
  ) {
    const parts = input.match.split(/\s+vs\.?\s+|\s+c\.\s+|\s+[–—]\s+|\s+-\s+/i);
    if (parts.length >= 2) {
      if (!local || /^local$/i.test(local)) local = parts[0]!.trim();
      if (!visitante || /^visitante$/i.test(visitante)) {
        visitante = parts[1]!.replace(/\s+\d{3,6}.*$/, "").trim();
      }
    }
  }
  if (!local || /^local$/i.test(local)) local = "LOCAL";
  if (!visitante || /^visitante$/i.test(visitante)) visitante = "VISITANTE";

  const override = (input.divisionLabelOverride || "").trim();
  const cat =
    override ||
    formatDivisionLabel(input.division, input.category) ||
    (input.division && input.division.length <= 12 ? input.division : null) ||
    "";

  const date =
    formatMatchDate(input.matchDate) ||
    formatMatchDate(input.sessionDate) ||
    "";

  const exp = formatExpediente(input.expedienteNumber, input.id) || "S/N";

  const localTitle = formatClubName(local) || local;
  const visitTitle = formatClubName(visitante) || visitante;

  return `${formatClubTitle(localTitle)} c. ${formatClubTitle(visitTitle)}${cat ? ` ${cat}` : ""}${date ? ` ${date}` : ""} EXPTE. ${exp}:`;
}

export function composeFalloText(
  header: string,
  items: ResolutionItem[],
): string {
  if (items.length === 0) return ensurePartidosEnLetras(header);
  if (items.length === 1) {
    return ensurePartidosEnLetras(`${header}\n${items[0]!.bodyText}`);
  }
  const lines = items.map(
    (item, index) => `${index + 1}°) ${item.bodyText}`,
  );
  return ensurePartidosEnLetras(`${header}\n${lines.join("\n")}`);
}

export function splitFalloFullText(fullText: string): {
  header: string;
  body: string;
} {
  const text = String(fullText || "").trim();
  if (!text) return { header: "", body: "" };
  const nl = text.indexOf("\n");
  if (nl < 0) {
    const colon = text.indexOf(":");
    if (colon >= 0 && colon < 180) {
      return {
        header: text.slice(0, colon + 1).trim(),
        body: text.slice(colon + 1).trim(),
      };
    }
    return { header: text, body: "" };
  }
  return {
    header: text.slice(0, nl).trim(),
    body: text.slice(nl + 1).trim(),
  };
}

export function finalizeDraft(partial: {
  caseKey?: string;
  header: string;
  items: Array<
    Omit<ResolutionItem, "order" | "bodyText"> & { bodyText?: string }
  >;
  confidence: number;
  status?: FalloDraft["status"];
  rationale?: string;
  redactorModel?: string | null;
}): FalloDraft {
  const sorted = sortResolutionItems(partial.items);
  const items: ResolutionItem[] = sorted.map((item, index) => ({
    ...item,
    order: index + 1,
    bodyText: buildResolutionBody(item),
  }));

  const fullText = composeFalloText(partial.header, items);
  const { body } = splitFalloFullText(fullText);

  return {
    title: partial.header,
    header: partial.header,
    body,
    fullText,
    items,
    confidence: partial.confidence,
    status: partial.status ?? "proposed",
    rationale: partial.rationale,
    redactorModel: partial.redactorModel ?? "manual",
    updatedAt: new Date().toISOString(),
  };
}
