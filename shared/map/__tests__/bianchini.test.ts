/**
 * Fixture de texto CASO Bianchini (tribunal-app) + asserts de mapeo clásico.
 * Ejecutar: npx tsx shared/map/__tests__/bianchini.test.ts
 */

import assert from "node:assert/strict";
import {
  extractClubDelInfractorRaw,
  extractCometFacts,
  extractInfractorRaw,
} from "../comet-extract";
import { mapFactsFromText } from "../map-from-text";
import { formatPersonName } from "../sanitize";

export const BIANCHINI_CASO_TEXT = `COMET - Asociación del Fútbol Argentino Fecha: 25.08.2026 Hora: 12:17:12 ART Impreso por: Benicio Rodriguez Alonso (341701025) Decisión de caso disciplinario Núm: 397794172 Fecha: 25.08.2026 Estado: ENTRADO Artículo: 0 Organización: ASOCIACION DEL FUTBOL ARGENTINO - ASOCIACION NACIONAL Tipo de infractor: Jugador Expulsado: Sí Infractor: BIANCHINI, CAMILA ROSARIO Club: CENTRO ASTURIANO DE BUENOS AIRES Competición: Torneo de Futsal Femenino - Primera Division B - 3RA Disciplina: Futsal Fecha: 22 Partido: ARGENTINOS JUNIORS - CENTRO ASTURIANO Tipo de evento: Tarjeta amarilla - Desaprobar con palabras o acciones Descripción de infracción: Expulsado del juego por dos tarjetas amarillas (primera en 24. min, Conducta antideportiva, y la segunda en 29. min, Desaprobar con palabras o acciones). Tipo de sanción Valor Fecha hastaFecha desde Estado Suspensión por partidos ACTIVO1 par. (Queda: 1) 25.08.2026 COMET - Asociación del Fútbol Argentino - Decisión de caso disciplinario Página: 1 / 1`;

function run(): void {
  assert.equal(
    extractInfractorRaw(BIANCHINI_CASO_TEXT),
    "BIANCHINI, CAMILA ROSARIO",
  );

  const clubRaw = extractClubDelInfractorRaw(BIANCHINI_CASO_TEXT);
  assert.ok(clubRaw, "club raw no debe ser null");
  assert.match(clubRaw!, /centro\s+asturiano/i);

  const facts = extractCometFacts(BIANCHINI_CASO_TEXT, {
    matchFolder: "ARGENTINOS JUNIORS - CENTRO ASTURIANO",
    fileName: "caso.pdf",
  });
  assert.match(facts.homeClub || "", /argentinos\s+juniors/i);
  assert.match(facts.awayClub || "", /centro\s+asturiano/i);
  assert.doesNotMatch(facts.awayClub || "", /tipo\s+de\s+evento/i);
  assert.equal(
    formatPersonName(extractInfractorRaw(BIANCHINI_CASO_TEXT)),
    "Camila Rosario Bianchini",
  );
  assert.equal(facts.person, "Camila Rosario Bianchini");
  assert.match(facts.club || "", /centro\s+asturiano/i);
  assert.equal(facts.role, "jugador");
  assert.match(facts.competition || "", /futsal\s+femenino/i);

  const mapped = mapFactsFromText(BIANCHINI_CASO_TEXT, {
    folderName: "ARGENTINOS JUNIORS - CENTRO ASTURIANO",
    fileName: "caso.pdf",
  });
  assert.equal(mapped.kind, "caso");
  assert.equal(mapped.person, "Camila Rosario Bianchini");
  assert.match(mapped.homeClub || "", /argentinos/i);
  assert.match(mapped.awayClub || "", /asturiano/i);
  assert.ok(mapped.confidence >= 60);

  console.log("OK — Bianchini fixture passed");
}

run();
