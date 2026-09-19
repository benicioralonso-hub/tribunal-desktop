import type { MappedCase } from "../map/types";

export type AuditFieldKey =
  | "person"
  | "club"
  | "role"
  | "homeClub"
  | "awayClub"
  | "matchDate"
  | "competition";

/** Respuesta JSON esperada de Gemini por caso. */
export type AuditLlmResponse = {
  person: string | null;
  club: string | null;
  role: string | null;
  homeClub: string | null;
  awayClub: string | null;
  matchDate: string | null;
  competition: string | null;
  notes: string[];
};

export type AuditedCase = Omit<MappedCase, "engine"> & {
  engine: "classical" | "audited";
  auditNotes: string[];
  auditModel?: string;
  correctionsApplied: boolean;
};

export type AuditProgressEvent = {
  done: number;
  total: number;
  label: string;
  currentCaseId?: string;
};

export type AuditCasesResult =
  | { ok: true; cases: AuditedCase[]; durationMs: number; correctedCount: number }
  | { ok: false; error: string };

export const AUDIT_JSON_SCHEMA = {
  name: "mapping_audit",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "person",
      "club",
      "role",
      "homeClub",
      "awayClub",
      "matchDate",
      "competition",
      "notes",
    ],
    properties: {
      person: { type: ["string", "null"] },
      club: { type: ["string", "null"] },
      role: { type: ["string", "null"] },
      homeClub: { type: ["string", "null"] },
      awayClub: { type: ["string", "null"] },
      matchDate: { type: ["string", "null"] },
      competition: { type: ["string", "null"] },
      notes: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
} as const;
