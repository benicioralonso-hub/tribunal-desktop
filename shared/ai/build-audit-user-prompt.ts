import type { MappedCase } from "../map/types";

/**
 * User prompt: solo campos del mapeo (sin PDF).
 * El system prompt (AUDIT_SYSTEM_PROMPT) va aparte e inmutable.
 */
export function fieldsFromMapped(m: MappedCase) {
  return {
    id: m.id,
    folderName: m.folderName,
    person: m.person,
    club: m.club,
    role: m.role,
    homeClub: m.homeClub,
    awayClub: m.awayClub,
    matchDate: m.matchDate,
    competition: m.competition,
  };
}

/** Un solo caso (compat). */
export function buildAuditUserPrompt(mapped: MappedCase): string {
  return buildAuditBatchUserPrompt([mapped]);
}

/** Batch de casos → un solo user message. */
export function buildAuditBatchUserPrompt(cases: MappedCase[]): string {
  const payload = cases.map(fieldsFromMapped);
  return `Auditar los siguientes casos mapeados (JSON array).
Para CADA caso devolvé un objeto con: id (igual al de entrada), person, club, role, homeClub, awayClub, matchDate, competition, notes (string[]).
Si no hay errores en un caso, repetí los valores y notes: [].
Solo ortografía, tipeo y discordancias de género. NO reescribas fallos ni inventes sanciones.

Casos:
${JSON.stringify(payload, null, 2)}

Respondé un JSON con forma: { "items": [ ... ] }`;
}
