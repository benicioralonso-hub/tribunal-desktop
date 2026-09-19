import type { MappedCase } from "../map/types";

const MAX_EXCERPT = 6_000;

function clip(text: string, max = MAX_EXCERPT): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…[truncado]`;
}

/**
 * User prompt: campos mapeados + extractos PDF.
 * El system prompt (AUDIT_SYSTEM_PROMPT) va aparte e inmutable.
 */
export function buildAuditUserPrompt(input: {
  mapped: MappedCase;
  casoText?: string;
  informeText?: string;
}): string {
  const m = input.mapped;
  const fields = {
    person: m.person,
    club: m.club,
    role: m.role,
    homeClub: m.homeClub,
    awayClub: m.awayClub,
    matchDate: m.matchDate,
    competition: m.competition,
  };

  return `Caso / carpeta: ${m.folderName}

Campos del mapeo previo (JSON):
${JSON.stringify(fields, null, 2)}

Texto CASO (extracto):
"""
${clip(input.casoText || "(sin texto CASO)")}
"""

Texto INFORME (extracto):
"""
${clip(input.informeText || "(sin texto INFORME)")}
"""

Devolvé un JSON con las mismas claves (person, club, role, homeClub, awayClub, matchDate, competition) ya corregidas si hace falta, y notes: string[] describiendo cada corrección. Si no hay errores, repetí los valores y notes: [].
NO reescribas el fallo ni inventes sanciones. Solo ortografía, tipeo y género.`;
}
