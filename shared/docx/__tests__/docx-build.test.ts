/**
 * Fixture: genera buffer DOCX no vacío (sin Electron).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { buildBoletinDocxBuffer } from "../build-boletin-docx";
import type { AuditedCase } from "../../ai/audit-types";

const cases: AuditedCase[] = [
  {
    id: "d1",
    folderPath: "/demo/P1",
    folderName: "Partido-Demo",
    casoPdfPath: null,
    informePdfPath: null,
    expediente: "99.001",
    homeClub: "Local FC",
    awayClub: "Visitante FC",
    person: "Camila Rosario Bianchini",
    club: "Local FC",
    role: "Jugadora",
    matchDate: "2026-03-15",
    competition: "Torneo",
    confidence: 0.9,
    engine: "audited",
    warning: null,
    draft: {
      title: "Local FC c. Visitante FC — 15/03/2026 — EXPTE. N° 99.001",
      body: "VISTO el expediente Nº 99.001…\n\nEL TRIBUNAL DE DISCIPLINA RESUELVE:\n\nSuspender a Camila Rosario Bianchini.",
      fullText:
        "Local FC c. Visitante FC — 15/03/2026 — EXPTE. N° 99.001\n\nVISTO el expediente Nº 99.001…\n\nEL TRIBUNAL DE DISCIPLINA RESUELVE:\n\nSuspender a Camila Rosario Bianchini.",
    },
    auditNotes: ['rol: "Jugador" → "Jugadora"'],
    correctionsApplied: true,
  },
];

const buf = await buildBoletinDocxBuffer(cases);
if (!Buffer.isBuffer(buf) || buf.byteLength < 1000) {
  throw new Error(`DOCX buffer too small: ${buf?.byteLength}`);
}
// ZIP magic PK
if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
  throw new Error("DOCX is not a ZIP/PK archive");
}

const outDir = path.resolve("tmp");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "fixture-boletin.docx");
writeFileSync(outPath, buf);
console.log(`OK — DOCX fixture ${buf.byteLength} bytes → ${outPath}`);
