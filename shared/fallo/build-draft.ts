/**
 * Redacción clásica del borrador de fallo (sin IA / sin códigos).
 * Template alineado al brief de producto; listo para enriquecer
 * con tipificación/sanciones cuando exista el dump de tribunal-app.
 */

import type { FalloDraft } from "../map/types";

const WARNING_SIN_CASO = "Alerta: este informe no tiene caso";

export { WARNING_SIN_CASO };

export type DraftInput = {
  expediente: string | null;
  homeClub: string | null;
  awayClub: string | null;
  matchDate: string | null;
  competition: string | null;
  person: string | null;
  role: string | null;
  club: string | null;
  /** true cuando hay informe pero ningún caso en la carpeta. */
  missingCaso?: boolean;
};

function orPlaceholder(value: string | null | undefined): string {
  const v = String(value || "").trim();
  return v || "[sin dato]";
}

export function buildFalloTitle(input: DraftInput): string {
  const home = orPlaceholder(input.homeClub);
  const away = orPlaceholder(input.awayClub);
  const date = input.matchDate?.trim() || null;
  const exp = input.expediente?.trim() || null;
  const bits = [`${home} c. ${away}`];
  if (date) bits.push(date);
  if (exp) bits.push(`EXPTE. N° ${exp}`);
  return bits.join(" — ");
}

export function buildFalloBody(input: DraftInput): string {
  const exp = orPlaceholder(input.expediente);
  const home = orPlaceholder(input.homeClub);
  const away = orPlaceholder(input.awayClub);
  const date = orPlaceholder(input.matchDate);
  const competition = input.competition?.trim();

  const vistoParts = [
    `VISTO el expediente Nº ${exp}, originado con motivo del partido ${home} c. ${away}, disputado el ${date}`,
  ];
  if (competition) {
    vistoParts.push(`en el marco de ${competition}`);
  }
  const visto = `${vistoParts.join(", ")}.`;

  if (input.missingCaso) {
    return [
      visto,
      "",
      "EL TRIBUNAL DE DISCIPLINA RESUELVE:",
      "",
      `[Pendiente] ${WARNING_SIN_CASO}. No se pudo redactar la resolución por falta de CASO disciplinario.`,
    ].join("\n");
  }

  const person = orPlaceholder(input.person);
  const role = input.role?.trim();
  const club = input.club?.trim();

  const sujetoBits = [person];
  if (role) sujetoBits.push(`(${role})`);
  if (club) sujetoBits.push(`del club ${club}`);
  const sujeto = sujetoBits.join(" ");

  return [
    visto,
    "",
    "EL TRIBUNAL DE DISCIPLINA RESUELVE:",
    "",
    `Suspender a ${sujeto}, de conformidad con las constancias del expediente, hasta tanto se determine la sanción definitiva conforme al Código Disciplinario.`,
  ].join("\n");
}

export function buildFalloDraft(input: DraftInput): FalloDraft {
  const title = buildFalloTitle(input);
  const body = buildFalloBody(input);
  return {
    title,
    body,
    fullText: `${title}\n\n${body}`,
  };
}
