/**
 * Tipificación canónica — port de tribunal-app tests/tipify-tipo-evento.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractCometFacts,
  extractTipoEventoRaw,
} from "../../map/comet-extract";
import { formatClubName, isCometPageHeader } from "../../map/sanitize";
import {
  buildFalloDraft,
  resolvePersonTipify,
  WARNING_SIN_TIPIFICAR,
} from "../build-draft";
import {
  normalizeTipoEventoKey,
  tipifyFromTipoEvento,
} from "../tipify-tipo-evento";

const FULL_MALOGRAR =
  "Tarjeta roja - Malograr una oportunidad manifiesta de gol al oponente moviéndose hacia el jugador el gol sancionable con un tiro libre o penal";

test("tipifyFromTipoEvento: tabla canónica completa", () => {
  const cases: Array<{
    raw: string;
    kind: string;
    article: RegExp;
    partidos: number;
  }> = [
    {
      raw: "Expulsión - Conducta inadecuada dentro del banco",
      kind: "suspension_con_multa_ve",
      article: /13\s*1\.\s*c\)/i,
      partidos: 1,
    },
    {
      raw: FULL_MALOGRAR,
      kind: "suspension_partidos",
      article: /13\s*1\.\s*a\)/i,
      partidos: 1,
    },
    {
      raw: "Tarjeta amarilla - Retardar la reanudación del juego",
      kind: "suspension_con_multa_ve",
      article: /12\s*3\./i,
      partidos: 1,
    },
    {
      raw: "Tarjeta roja - Juego brusco grave",
      kind: "suspension_partidos",
      article: /13\s*1\.\s*e\)/i,
      partidos: 2,
    },
    {
      raw: "Tarjeta amarilla - Infracciones permanentes de Las Reglas de Juego",
      kind: "suspension_partidos",
      article: /Regla\s*12.*International Board/i,
      partidos: 1,
    },
    {
      raw: "Tarjeta roja - Conducta Violenta",
      kind: "suspension_partidos",
      article: /13\s*1\.\s*h\)/i,
      partidos: 3,
    },
    {
      raw: "Tarjeta amarilla - Conducta Antideportiva",
      kind: "suspension_partidos",
      article: /Regla\s*12.*International Board/i,
      partidos: 1,
    },
  ];

  for (const row of cases) {
    const tip = tipifyFromTipoEvento(row.raw);
    assert.ok(tip, `debe tipificar: ${row.raw}`);
    assert.equal(tip!.kind, row.kind);
    assert.match(tip!.article, row.article);
    assert.equal(tip!.partidos, row.partidos);
  }
});

test("tipifyFromTipoEvento: exclusión lenguaje ofensivo → null", () => {
  assert.equal(
    tipifyFromTipoEvento(
      "Tarjeta roja - Emplear lenguaje ofensivo, grosero u obsceno y/o gestos de la misma naturaleza",
    ),
    null,
  );
});

test("tipifyFromTipoEvento: desconocido / parcial → null", () => {
  assert.equal(tipifyFromTipoEvento(null), null);
  assert.equal(tipifyFromTipoEvento(""), null);
  assert.equal(tipifyFromTipoEvento("Tarjeta roja"), null);
  assert.equal(tipifyFromTipoEvento("Tarjeta roja - Juego brusco"), null);
  assert.equal(
    tipifyFromTipoEvento(
      "Tarjeta amarilla - Conducta inadecuada dentro del banco",
    ),
    null,
  );
  assert.equal(
    tipifyFromTipoEvento("Algo parecido a conducta violenta"),
    null,
  );
});

test("tipifyFromTipoEvento: normaliza acentos y espacios", () => {
  const tip = tipifyFromTipoEvento("  TARJETA ROJA  –  Conducta   Violenta  ");
  assert.ok(tip);
  assert.equal(tip!.partidos, 3);
  assert.equal(
    normalizeTipoEventoKey("Tarjeta roja - Conducta Violenta"),
    normalizeTipoEventoKey("tarjeta roja – conducta violenta"),
  );
});

test("tipifyFromTipoEvento: Malograr exige ancla + tokens", () => {
  assert.ok(tipifyFromTipoEvento(FULL_MALOGRAR));
  assert.ok(
    tipifyFromTipoEvento(
      "Tarjeta roja - Malograr una oportunidad manifiesta de gol … tiro libre",
    ),
  );
  assert.equal(
    tipifyFromTipoEvento(
      "Tarjeta roja - Malograr una oportunidad manifiesta de gol",
    ),
    null,
  );
});

test("extractTipoEventoRaw lee el label del PDF CASO", () => {
  const text = `
COMET - Asociación del Fútbol Argentino
Decisión de caso disciplinario
Tipo de infractor: Jugador
Infractor: ULLOA, MARIA
Club: CAMIONEROS
Partido: CAMIONEROS - RIVAL
Tipo de evento: Expulsión - Conducta inadecuada dentro del banco
Descripción de infracción: Insultos desde el banco.
`;
  assert.equal(
    extractTipoEventoRaw(text),
    "Expulsión - Conducta inadecuada dentro del banco",
  );
  const facts = extractCometFacts(text);
  assert.equal(
    facts.tipoEvento,
    "Expulsión - Conducta inadecuada dentro del banco",
  );
  assert.notEqual(facts.club, "COMET - Asociación del Fútbol Argentino");
  assert.match(String(facts.club), /Camioneros/i);
});

test("extractTipoEventoRaw tolera layout tabular (tipo + causal en 2 líneas)", () => {
  const text = `
COMET Decisión de caso disciplinario
Tipo de infractor: Jugador
Infractor: GOMEZ, ANA
Club: River
Partido: River - Boca
Tipo de evento:
Tarjeta roja
Juego brusco grave
Descripción de infracción: Entrada.
`;
  assert.equal(extractTipoEventoRaw(text), "Tarjeta roja - Juego brusco grave");
  assert.equal(tipifyFromTipoEvento(extractTipoEventoRaw(text))?.partidos, 2);
});

test("extractTipoEventoRaw: columnas Jasper (labels apilados, luego valores)", () => {
  const text = `
Decisión de caso disciplinario
Tipo de infractor
Infractor
Club
Partido
Tipo de evento
Descripción de infracción
Jugador
GIANINI, SANTINO
CLUB ATLETICO ALDOSIVI
ALDOSIVI - ARGENTINOS JUNIORS
Tarjeta roja - Conducta Violenta
Agresión al rival en el área.
`;
  assert.equal(extractTipoEventoRaw(text), "Tarjeta roja - Conducta Violenta");
  assert.equal(tipifyFromTipoEvento(extractTipoEventoRaw(text))?.partidos, 3);
});

test("cabecera COMET no es club", () => {
  assert.equal(isCometPageHeader("COMET - Asociación del Fútbol Argentino"), true);
  assert.equal(formatClubName("COMET - Asociación del Fútbol Argentino"), null);
  assert.equal(formatClubName("Impreso por: Alguien"), null);
});

test("buildFalloDraft: canónico tipifica; exclusión → sin_tipificar", () => {
  const tipificado = buildFalloDraft({
    expediente: "1",
    homeClub: "River",
    awayClub: "Boca",
    matchDate: "01/01/2026",
    competition: null,
    persons: [
      {
        person: "Ana",
        club: "River",
        role: "jugadora",
        tipoEvento: "Tarjeta roja - Juego brusco grave",
      },
    ],
  });
  assert.notEqual(tipificado.status, "sin_tipificar");
  assert.match(tipificado.body, /dos partidos|2 partidos|dos partidos/i);
  assert.match(tipificado.body, /13\s*1\.\s*e\)/i);

  const sin = buildFalloDraft({
    expediente: "2",
    homeClub: "River",
    awayClub: "Boca",
    matchDate: "01/01/2026",
    competition: null,
    persons: [
      {
        person: "Luis",
        club: "River",
        role: "jugador",
        tipoEvento:
          "Tarjeta roja - Emplear lenguaje ofensivo, grosero u obsceno y/o gestos de la misma naturaleza",
      },
    ],
  });
  assert.equal(sin.status, "sin_tipificar");
  assert.match(sin.body, /Pendiente de tipificación manual/i);
  assert.equal(sin.rationale, WARNING_SIN_TIPIFICAR);

  const da = resolvePersonTipify({
    person: "X",
    club: "Y",
    role: "jugador",
    tipoEvento: "Tarjeta amarilla - Desaprobar con palabras o acciones",
    signals: ["doble_amonestacion"],
  });
  assert.equal(da.sinTipificar, false);
  assert.equal(da.kind, "doble_amonestacion");
});
