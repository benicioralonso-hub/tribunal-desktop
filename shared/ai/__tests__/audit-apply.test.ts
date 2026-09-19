/**
 * Fixture: parse + apply de respuesta Gemini (sin red).
 */
import {
  applyAuditResponse,
  parseAuditLlmResponse,
} from "../apply-audit-response";
import type { MappedCase } from "../../map/types";

const base: MappedCase = {
  id: "t1",
  folderPath: "/demo/Partido",
  folderName: "Partido",
  casoPdfPath: null,
  informePdfPath: null,
  homeClub: "Club Atlético Demo",
  awayClub: "Visitante",
  person: "Camila Rosario Bianchini",
  club: "Club Atlético Demo",
  role: "Jugador",
  matchDate: "2026-03-15",
  competition: "Torneo",
  confidence: 0.9,
  engine: "classical",
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const raw = `
\`\`\`json
{
  "person": "Camila Rosario Bianchini",
  "club": "Club Atlético Demo",
  "role": "Jugadora",
  "homeClub": "Club Atlético Demo",
  "awayClub": "Visitante",
  "matchDate": "2026-03-15",
  "competition": "Torneo",
  "notes": ["rol: Jugador → Jugadora (discordancia de género)"]
}
\`\`\`
`;

const parsed = parseAuditLlmResponse(raw);
assert(parsed.role === "Jugadora", `expected Jugadora, got ${parsed.role}`);
assert(parsed.notes.length === 1, "expected one note");

const applied = applyAuditResponse(base, parsed, "gemini-2.0-flash");
assert(applied.correctionsApplied, "expected correctionsApplied");
assert(applied.role === "Jugadora", "role not applied");
assert(applied.engine === "audited", "engine should be audited");
assert(applied.auditModel === "gemini-2.0-flash", "model missing");
assert(
  applied.person === base.person,
  "person should stay unchanged",
);

const noop = parseAuditLlmResponse(
  JSON.stringify({
    person: base.person,
    club: base.club,
    role: base.role,
    homeClub: base.homeClub,
    awayClub: base.awayClub,
    matchDate: base.matchDate,
    competition: base.competition,
    notes: [],
  }),
);
const same = applyAuditResponse(base, noop);
assert(!same.correctionsApplied, "no corrections expected");
assert(same.engine === "classical", "engine stays classical");

console.log("OK — audit apply/parse fixture passed");
