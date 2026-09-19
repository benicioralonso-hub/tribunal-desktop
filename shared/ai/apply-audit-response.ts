import type { MappedCase } from "../map/types";
import type { AuditedCase, AuditLlmResponse } from "./audit-types";
import { extractJsonContent } from "./gemini-client";

const FIELD_KEYS = [
  "person",
  "club",
  "role",
  "homeClub",
  "awayClub",
  "matchDate",
  "competition",
] as const;

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/**
 * Parsea la respuesta JSON de Gemini y aplica correcciones al MappedCase.
 * Exportado para tests unitarios sin red.
 */
export function parseAuditLlmResponse(raw: string): AuditLlmResponse {
  const json = extractJsonContent(raw);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const notesRaw = parsed.notes;
  const notes = Array.isArray(notesRaw)
    ? notesRaw.map((n) => String(n).trim()).filter(Boolean)
    : [];

  return {
    person: asNullableString(parsed.person),
    club: asNullableString(parsed.club),
    role: asNullableString(parsed.role),
    homeClub: asNullableString(parsed.homeClub),
    awayClub: asNullableString(parsed.awayClub),
    matchDate: asNullableString(parsed.matchDate),
    competition: asNullableString(parsed.competition),
    notes,
  };
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export function applyAuditResponse(
  mapped: MappedCase,
  response: AuditLlmResponse,
  auditModel?: string,
): AuditedCase {
  let correctionsApplied = false;
  const notes = [...response.notes];

  const next: AuditedCase = {
    ...mapped,
    engine: "audited",
    auditNotes: notes,
    auditModel,
    correctionsApplied: false,
  };

  for (const key of FIELD_KEYS) {
    const before = mapped[key];
    const after = response[key];
    if (norm(before) !== norm(after)) {
      correctionsApplied = true;
      next[key] = after;
      if (
        !notes.some((n) =>
          n.toLowerCase().includes(key.toLowerCase()),
        )
      ) {
        notes.push(
          `${key}: "${before ?? "—"}" → "${after ?? "—"}"`,
        );
      }
    }
  }

  next.auditNotes = notes;
  next.correctionsApplied = correctionsApplied;
  if (correctionsApplied) {
    next.engine = "audited";
  } else {
    next.engine = "classical";
  }

  return next;
}

/** Fallback si Gemini falla: caso sin cambios, con nota de error. */
export function auditPassthrough(
  mapped: MappedCase,
  errorNote: string,
): AuditedCase {
  return {
    ...mapped,
    engine: "classical",
    auditNotes: [errorNote],
    correctionsApplied: false,
  };
}
