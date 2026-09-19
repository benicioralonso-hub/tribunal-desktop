/**
 * Genera un DOCX resumen de casos auditados.
 * Tipografía: Montserrat (Medium≈500 / Bold), 12pt, justificado,
 * títulos subrayados, cuerpo sin subrayar.
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from "docx";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AuditedCase } from "../ai/audit-types";

const FONT = "Montserrat";
const SIZE_BODY = 24; // 12pt (half-points)
const SIZE_TITLE = 28; // 14pt

function resolveFontsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "assets/fonts"),
    path.resolve(here, "../../assets/fonts"),
    path.resolve(here, "../../../assets/fonts"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "Montserrat-Regular.ttf"))) return dir;
  }
  return candidates[0]!;
}

function loadFont(fileName: string): Buffer | null {
  const full = path.join(resolveFontsDir(), fileName);
  if (!existsSync(full)) return null;
  return readFileSync(full);
}

function bodyRun(
  text: string,
  opts?: { bold?: boolean; underline?: boolean },
): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: SIZE_BODY,
    bold: opts?.bold ?? false,
    underline: opts?.underline
      ? { type: UnderlineType.SINGLE }
      : undefined,
  });
}

function titleParagraph(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.BOTH,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: SIZE_BODY,
        bold: true,
        underline: { type: UnderlineType.SINGLE },
      }),
    ],
  });
}

function bodyParagraph(
  text: string,
  opts?: { bold?: boolean; after?: number },
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { after: opts?.after ?? 80 },
    children: [bodyRun(text, { bold: opts?.bold })],
  });
}

export function buildBoletinDocument(cases: AuditedCase[]): Document {
  const regular = loadFont("Montserrat-Regular.ttf");
  const medium = loadFont("Montserrat-Medium.ttf");
  const bold = loadFont("Montserrat-Bold.ttf");

  const fonts = [
    regular ? { name: FONT, data: regular } : null,
    medium ? { name: FONT, data: medium } : null,
    bold ? { name: FONT, data: bold } : null,
  ].filter(Boolean) as { name: string; data: Buffer }[];

  const today = new Date().toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "Tribunal de Disciplina — Resumen de mapeo/auditoría",
          font: FONT,
          size: SIZE_TITLE,
          bold: true,
          underline: { type: UnderlineType.SINGLE },
        }),
      ],
    }),
  );

  children.push(
    bodyParagraph(`Fecha de exportación: ${today}`, { after: 40 }),
  );
  children.push(
    bodyParagraph(`Casos incluidos: ${cases.length}`, { after: 200 }),
  );
  children.push(
    bodyParagraph(
      "Documento generado localmente. Tipografía Montserrat 12pt, justificado; títulos en negrita subrayados.",
      { after: 280 },
    ),
  );

  for (const c of cases) {
    const titleBits = [c.folderName, c.person].filter(Boolean).join(" — ");
    children.push(titleParagraph(titleBits || "Caso"));

    const lines = [
      `Local: ${c.homeClub ?? "—"}`,
      `Visitante: ${c.awayClub ?? "—"}`,
      `Infractor: ${c.person ?? "—"}`,
      `Rol: ${c.role ?? "—"}`,
      `Club: ${c.club ?? "—"}`,
      `Fecha: ${c.matchDate ?? "—"}`,
      `Competición: ${c.competition ?? "—"}`,
      `Confianza mapeo: ${c.confidence}`,
      `Motor: ${c.engine}`,
    ];
    for (const line of lines) {
      children.push(bodyParagraph(line, { after: 40 }));
    }
    if (c.auditNotes.length > 0) {
      children.push(
        bodyParagraph(`Notas de auditoría: ${c.auditNotes.join(" · ")}`, {
          after: 160,
        }),
      );
    } else {
      children.push(bodyParagraph("Notas de auditoría: (ninguna)", { after: 160 }));
    }
  }

  return new Document({
    fonts: fonts.length > 0 ? fonts : undefined,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children,
      },
    ],
  });
}

export async function buildBoletinDocxBuffer(
  cases: AuditedCase[],
): Promise<Buffer> {
  const doc = buildBoletinDocument(cases);
  return Packer.toBuffer(doc);
}
