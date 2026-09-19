/**
 * Tests: isMatchFolderName + buildMappedCases (pairing / warning / 4TA).
 * Ejecutar vía npm run test:map
 */
import assert from "node:assert/strict";
import { isMatchFolderName, parseMatchFolderName } from "../sanitize";
import {
  buildMappedCases,
  type PdfHit,
  type MapWorkerResult,
} from "../build-mapped-cases";
import { WARNING_SIN_CASO } from "../../fallo/build-draft";
import type { MapFacts } from "../map-from-text";

function facts(partial: Partial<MapFacts> & { kind: MapFacts["kind"] }): MapFacts {
  return {
    person: null,
    club: null,
    role: null,
    homeClub: null,
    awayClub: null,
    matchDate: null,
    competition: null,
    confidence: 0.8,
    ...partial,
  };
}

function okResult(pdfPath: string, f: MapFacts): MapWorkerResult {
  return { ok: true, pdfPath, facts: f, textLen: 100 };
}

// --- isMatchFolderName ---
assert.equal(isMatchFolderName("4TA"), false, "4TA no es partido");
assert.equal(isMatchFolderName("3RA"), false);
assert.equal(isMatchFolderName("0001"), false);
assert.equal(isMatchFolderName("0014"), false);
assert.equal(isMatchFolderName("Informes"), false);
assert.equal(isMatchFolderName("Casos"), false);
assert.equal(
  isMatchFolderName("River Plate c. Boca Juniors 99.523"),
  true,
);
assert.equal(
  isMatchFolderName("ARGENTINOS JUNIORS - CENTRO ASTURIANO"),
  true,
);

const parsed = parseMatchFolderName("River Plate c. Boca Juniors 99.523");
assert.equal(parsed.expedienteHint, "99.523");
assert.match(parsed.homeClub || "", /river/i);
assert.match(parsed.awayClub || "", /boca/i);

// --- buildMappedCases: informe sin caso ---
{
  const folder =
    "/boletin/0001/River Plate c. Boca Juniors 99.523";
  const folderName = "River Plate c. Boca Juniors 99.523";
  const informePath = `${folder}/INFORME.pdf`;
  const pdfs: PdfHit[] = [
    {
      absolutePath: informePath,
      folderPath: folder,
      folderName,
    },
  ];
  const byPath = new Map<string, MapWorkerResult>([
    [
      informePath,
      okResult(
        informePath,
        facts({
          kind: "informe",
          homeClub: "River Plate",
          awayClub: "Boca Juniors",
          matchDate: "15/03/2026",
          competition: "Primera",
        }),
      ),
    ],
  ]);
  const cases = buildMappedCases(pdfs, byPath);
  assert.equal(cases.length, 1);
  assert.equal(cases[0]!.warning, WARNING_SIN_CASO);
  assert.equal(cases[0]!.casoPdfPath, null);
  assert.equal(cases[0]!.expediente, "99.523");
  assert.ok(cases[0]!.draft?.fullText.includes("VISTO el expediente"));
  assert.ok(cases[0]!.draft?.fullText.includes(WARNING_SIN_CASO));
}

// --- 4TA no genera casos (PDF bajo categoría ignorado en walk; aquí simulado) ---
{
  const pdfs: PdfHit[] = [
    {
      absolutePath: "/boletin/4TA/orphan.pdf",
      folderPath: "/boletin/4TA",
      folderName: "4TA",
    },
  ];
  const byPath = new Map<string, MapWorkerResult>([
    [
      "/boletin/4TA/orphan.pdf",
      okResult(
        "/boletin/4TA/orphan.pdf",
        facts({ kind: "caso", person: "Fake" }),
      ),
    ],
  ]);
  const cases = buildMappedCases(pdfs, byPath);
  assert.equal(
    cases.length,
    0,
    "PDFs bajo 4TA no deben generar MappedCase",
  );
}

// --- 1 informe → N casos ---
{
  const folder = "/boletin/0001/Local - Visitante 12345";
  const folderName = "Local - Visitante 12345";
  const informePath = `${folder}/INFORME.pdf`;
  const caso1 = `${folder}/CASO-1.pdf`;
  const caso2 = `${folder}/CASO-2.pdf`;
  const pdfs: PdfHit[] = [
    { absolutePath: informePath, folderPath: folder, folderName },
    { absolutePath: caso1, folderPath: folder, folderName },
    { absolutePath: caso2, folderPath: folder, folderName },
  ];
  const byPath = new Map<string, MapWorkerResult>([
    [
      informePath,
      okResult(
        informePath,
        facts({
          kind: "informe",
          homeClub: "Local",
          awayClub: "Visitante",
          matchDate: "01/01/2026",
        }),
      ),
    ],
    [
      caso1,
      okResult(
        caso1,
        facts({ kind: "caso", person: "Juan Pérez", role: "jugador" }),
      ),
    ],
    [
      caso2,
      okResult(
        caso2,
        facts({ kind: "caso", person: "Ana Gómez", role: "jugadora" }),
      ),
    ],
  ]);
  const cases = buildMappedCases(pdfs, byPath);
  assert.equal(cases.length, 2);
  assert.equal(cases[0]!.informePdfPath, informePath);
  assert.equal(cases[1]!.informePdfPath, informePath);
  assert.equal(cases[0]!.warning, null);
  assert.ok(cases[0]!.draft?.fullText.includes("Suspender a"));
  assert.equal(cases[0]!.expediente, "12345");
}

console.log("OK — match-folder + buildMappedCases fixtures");
