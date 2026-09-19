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
  id?: string;
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
  cancelled?: boolean;
};

export type AuditCasesResult =
  | {
      ok: true;
      cases: AuditedCase[];
      durationMs: number;
      correctedCount: number;
      cancelled?: boolean;
      mode: "gemini" | "local" | "mixed";
    }
  | { ok: false; error: string; cancelled?: boolean };

export type AuditStatusResult = {
  configured: boolean;
};

export type AuditMappedCasesOptions = {
  /** Si true, aplica solo heurística local (sin Gemini). */
  skipAi?: boolean;
};

export const AUDIT_BATCH_SIZE = 20;

export const AUDIT_BATCH_JSON_SCHEMA = {
  name: "mapping_audit_batch",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
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
            id: { type: "string" },
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
      },
    },
  },
} as const;
