/**
 * Fixture: borrador clásico VISTO / RESUELVE.
 */
import assert from "node:assert/strict";
import {
  buildFalloDraft,
  WARNING_SIN_CASO,
} from "../build-draft";

const draft = buildFalloDraft({
  expediente: "99.523",
  homeClub: "River Plate",
  awayClub: "Boca Juniors",
  matchDate: "15/03/2026",
  competition: "Primera División",
  person: "Juan Pérez",
  role: "jugador",
  club: "River Plate",
});

assert.match(draft.title, /River Plate c\. Boca Juniors/);
assert.match(draft.title, /EXPTE\. N° 99\.523/);
assert.match(draft.body, /VISTO el expediente Nº 99\.523/);
assert.match(draft.body, /originado con motivo del partido River Plate c\. Boca Juniors/);
assert.match(draft.body, /disputado el 15\/03\/2026/);
assert.match(draft.body, /EL TRIBUNAL DE DISCIPLINA RESUELVE/);
assert.match(draft.body, /Suspender a Juan Pérez \(jugador\) del club River Plate/);
assert.ok(draft.fullText.includes(draft.title));
assert.ok(draft.fullText.includes(draft.body));

const missing = buildFalloDraft({
  expediente: "11.111",
  homeClub: "A",
  awayClub: "B",
  matchDate: "01/01/2026",
  competition: null,
  person: null,
  role: null,
  club: null,
  missingCaso: true,
});
assert.ok(missing.body.includes(WARNING_SIN_CASO));
assert.doesNotMatch(missing.body, /Suspender a/);

const empty = buildFalloDraft({
  expediente: null,
  homeClub: null,
  awayClub: null,
  matchDate: null,
  competition: null,
  person: null,
  role: null,
  club: null,
});
assert.match(empty.body, /\[sin dato\]/);

console.log("OK — build-draft fixtures");
