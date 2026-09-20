/**
 * Fixture: borrador manual automático (mismo formato web).
 */
import assert from "node:assert/strict";
import { buildFalloDraft, WARNING_SIN_CASO } from "../build-draft";
import { buildManualFalloDraft } from "../manual-fallo";
import { buildFalloHeader, buildResolutionBody } from "../render-fallo";

const header = buildFalloHeader({
  homeClub: "River Plate",
  awayClub: "Boca Juniors",
  matchDate: "15/03/2026",
  expedienteNumber: "99523",
});
assert.match(header, /RIVER PLATE c\. BOCA JUNIORS/);
assert.match(header, /EXPTE\. 99523:/);
assert.doesNotMatch(header, /VISTO/);

const body = buildResolutionBody({
  kind: "suspension_partidos",
  personName: "Juan Pérez",
  role: "jugador",
  club: "River Plate",
  partidos: 1,
  article: "Art. 13 1. e) del Código Disciplinario",
});
assert.match(body, /Se suspende por un partido al jugador Juan Pérez/);
assert.match(body, /del Club River Plate/);
assert.match(body, /Art\. 13 1\. e\) del Código Disciplinario\.-/);

const manual = buildManualFalloDraft({
  homeClub: "River Plate",
  awayClub: "Boca Juniors",
  matchDate: "15/03/2026",
  expedienteNumber: "99523",
  resolutions: [
    {
      kind: "suspension_partidos",
      personName: "Juan Pérez",
      club: "River Plate",
      role: "jugador",
      partidos: 1,
    },
  ],
});
assert.equal(manual.header, manual.title);
assert.ok(manual.fullText.startsWith(manual.header));
assert.ok(manual.body.includes("Se suspende por un partido"));
assert.equal(manual.redactorModel, "manual");
assert.equal(manual.items.length, 1);

const doble = buildFalloDraft({
  expediente: "99523",
  homeClub: "Arsenal F.C.",
  awayClub: "Racing Club",
  matchDate: "01/01/2026",
  competition: null,
  persons: [
    {
      person: "Ana Gómez",
      club: "Arsenal F.C.",
      role: "jugadora",
      dobleAmonestacion: true,
    },
  ],
});
assert.match(doble.body, /Se suspende por un partido a la jugadora Ana Gómez/);
assert.match(doble.fullText, /Regla 12 del International Board\. \(doble amonestación\)\.-/);

const multi = buildFalloDraft({
  expediente: "88001",
  homeClub: "Local",
  awayClub: "Visitante",
  matchDate: "10/03/2026",
  competition: "1ra.",
  persons: [
    { person: "A Uno", club: "Local", role: "jugador", partidos: 2 },
    { person: "B Dos", club: "Visitante", role: "jugador", partidos: 1 },
  ],
});
assert.match(multi.fullText, /1°\)/);
assert.match(multi.fullText, /2°\)/);
assert.match(multi.body, /dos partidos/);

const missing = buildFalloDraft({
  expediente: "77100",
  homeClub: "Independiente",
  awayClub: "Racing",
  matchDate: "10/03/2026",
  competition: null,
  persons: [],
  missingCaso: true,
});
assert.ok(missing.body.includes(WARNING_SIN_CASO));
assert.doesNotMatch(missing.body, /Se suspende/);

console.log("OK — build-draft manual fixtures");
