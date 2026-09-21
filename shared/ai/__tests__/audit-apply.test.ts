/**
 * Fixture: parse batch + apply + heurística de género (sin red).
 */
import {
  applyAuditResponse,
  auditWithLocalHeuristic,
  parseAuditBatchResponse,
  parseAuditLlmResponse,
} from "../apply-audit-response";
import { applyGenderHeuristic } from "../gender-heuristic";
import type { MappedCase } from "../../map/types";

const base: MappedCase = {
  id: "t1",
  folderPath: "/demo/Partido",
  folderName: "Partido",
  casoPdfPath: null,
  informePdfPath: null,
  expediente: "12.345",
  homeClub: "Club Atlético Demo",
  awayClub: "Visitante",
  person: "Camila Rosario Bianchini",
  club: "Club Atlético Demo",
  role: "Jugador",
  matchDate: "2026-03-15",
  competition: "Torneo",
  tipoEvento: null,
  categoryRoot: "0001",
  confidence: 0.9,
  engine: "classical",
  warning: null,
  draft: null,
  included: true,
  informeIncluded: true,
  attachments: [],
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
assert(applied.person === base.person, "person should stay unchanged");

const batchRaw = JSON.stringify({
  items: [
    {
      id: "t1",
      person: "Camila Rosario Bianchini",
      club: "Club Atlético Demo",
      role: "Jugadora",
      homeClub: "Club Atlético Demo",
      awayClub: "Visitante",
      matchDate: "2026-03-15",
      competition: "Torneo",
      notes: ["género"],
    },
    {
      id: "t2",
      person: "Juan Pérez",
      club: "X",
      role: "Jugador",
      homeClub: "X",
      awayClub: "Y",
      matchDate: null,
      competition: null,
      notes: [],
    },
  ],
});
const batch = parseAuditBatchResponse(batchRaw);
assert(batch.length === 2, "batch length");
assert(batch[0]!.id === "t1" && batch[0]!.role === "Jugadora", "batch item 0");
assert(batch[1]!.id === "t2" && batch[1]!.notes.length === 0, "batch item 1");

const h = applyGenderHeuristic("Camila Bianchini", "Jugador");
assert(h.changed && h.role === "Jugadora", "heuristic female");

const local = auditWithLocalHeuristic(base, "sin GEMINI_API_KEY");
assert(local.correctionsApplied, "local should correct");
assert(local.role === "Jugadora", "local role");
assert(
  local.auditNotes.some((n) => n.includes("sin GEMINI_API_KEY")),
  "prefix note",
);

const noop = parseAuditLlmResponse(
  JSON.stringify({
    person: base.person,
    club: base.club,
    role: "Jugadora",
    homeClub: base.homeClub,
    awayClub: base.awayClub,
    matchDate: base.matchDate,
    competition: base.competition,
    notes: [],
  }),
);
const alreadyOk: MappedCase = { ...base, role: "Jugadora" };
const same = applyAuditResponse(alreadyOk, noop);
assert(!same.correctionsApplied, "no corrections expected");
assert(same.engine === "classical", "engine stays classical");

console.log("OK — audit apply/parse/batch/heuristic fixture passed");
