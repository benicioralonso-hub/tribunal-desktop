import type { MappedCase } from "../map/types";
import type { AuditedCase, AuditLlmResponse } from "./audit-types";
import { extractJsonContent } from "./gemini-client";
import { applyGenderHeuristic } from "./gender-heuristic";

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

function parseOneItem(parsed: Record<string, unknown>): AuditLlmResponse {
  const notesRaw = parsed.notes;
  const notes = Array.isArray(notesRaw)
    ? notesRaw.map((n) => String(n).trim()).filter(Boolean)
    : [];

  return {
    id: typeof parsed.id === "string" ? parsed.id : undefined,
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

/**
 * Parsea respuesta JSON de Gemini (un caso o batch { items: [...] }).
 */
export function parseAuditLlmResponse(raw: string): AuditLlmResponse {
  const json = extractJsonContent(raw);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  if (Array.isArray(parsed.items) && parsed.items[0]) {
    return parseOneItem(parsed.items[0] as Record<string, unknown>);
  }
  return parseOneItem(parsed);
}

/** Parsea batch completo. */
export function parseAuditBatchResponse(raw: string): AuditLlmResponse[] {
  const json = extractJsonContent(raw);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  if (Array.isArray(parsed.items)) {
    return parsed.items.map((item) =>
      parseOneItem(item as Record<string, unknown>),
    );
  }
  // Fallback: un solo objeto
  if (parsed.person !== undefined || parsed.id !== undefined) {
    return [parseOneItem(parsed)];
  }
  return [];
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
      if (!notes.some((n) => n.toLowerCase().includes(key.toLowerCase()))) {
        notes.push(`${key}: "${before ?? "—"}" → "${after ?? "—"}"`);
      }
    }
  }

  next.auditNotes = notes;
  next.correctionsApplied = correctionsApplied;
  next.engine = correctionsApplied ? "audited" : "classical";
  return next;
}

/** Aplica solo heurística de género local. */
export function auditWithLocalHeuristic(
  mapped: MappedCase,
  notePrefix?: string,
): AuditedCase {
  const h = applyGenderHeuristic(mapped.person, mapped.role);
  const notes: string[] = [];
  if (notePrefix) notes.push(notePrefix);
  if (h.changed && h.note) notes.push(h.note);

  return {
    ...mapped,
    role: h.role,
    engine: h.changed ? "audited" : "classical",
    auditNotes: notes,
    auditModel: "local-heuristic",
    correctionsApplied: h.changed,
  };
}

/** Fallback si Gemini falla: caso sin cambios (o con heurística), con nota. */
export function auditPassthrough(
  mapped: MappedCase,
  errorNote: string,
  useHeuristic = true,
): AuditedCase {
  if (useHeuristic) {
    const local = auditWithLocalHeuristic(mapped, errorNote);
    return local;
  }
  return {
    ...mapped,
    engine: "classical",
    auditNotes: [errorNote],
    correctionsApplied: false,
  };
}
