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
    tipoEvento: null,
    categoryRoot: "0001",
    confidence: 0.9,
    engine: "audited",
    warning: null,
    draft: {
      title: "LOCAL FC c. VISITANTE FC 15/03/2026 EXPTE. 99001:",
      header: "LOCAL FC c. VISITANTE FC 15/03/2026 EXPTE. 99001:",
      body: "Se suspende por un partido a la jugadora Camila Rosario Bianchini, del Club Local FC. Art. 13 1. e) del Código Disciplinario.-",
      fullText:
        "LOCAL FC c. VISITANTE FC 15/03/2026 EXPTE. 99001:\nSe suspende por un partido a la jugadora Camila Rosario Bianchini, del Club Local FC. Art. 13 1. e) del Código Disciplinario.-",
      items: [],
      confidence: 90,
      status: "proposed",
      redactorModel: "manual",
      updatedAt: new Date().toISOString(),
    },
    included: true,
    informeIncluded: true,
    attachments: [],
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
