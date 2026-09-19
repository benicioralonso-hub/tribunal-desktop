import { ipcMain, BrowserWindow } from "electron";
import { IPC } from "./channels";
import { AUDIT_SYSTEM_PROMPT } from "../../shared/ai/audit-prompt";
import {
  chatJsonCompletion,
  geminiConfigHint,
  isGeminiConfigured,
} from "../../shared/ai/gemini-client";
import { buildAuditBatchUserPrompt } from "../../shared/ai/build-audit-user-prompt";
import {
  applyAuditResponse,
  auditPassthrough,
  auditWithLocalHeuristic,
  parseAuditBatchResponse,
} from "../../shared/ai/apply-audit-response";
import {
  AUDIT_BATCH_JSON_SCHEMA,
  AUDIT_BATCH_SIZE,
  type AuditedCase,
  type AuditCasesResult,
  type AuditMappedCasesOptions,
  type AuditProgressEvent,
  type AuditStatusResult,
} from "../../shared/ai/audit-types";
import type { MappedCase } from "../../shared/map/types";

const BATCH_CONCURRENCY = 2;

/** Flag de cancelación por sesión de auditoría. */
let cancelRequested = false;

function broadcastProgress(ev: AuditProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.AUDIT_PROGRESS, ev);
  }
}

function isMappedCase(value: unknown): value is MappedCase {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.folderName === "string";
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function auditBatch(
  batch: MappedCase[],
): Promise<{ cases: AuditedCase[]; model?: string }> {
  try {
    const result = await chatJsonCompletion({
      messages: [
        { role: "system", content: AUDIT_SYSTEM_PROMPT },
        { role: "user", content: buildAuditBatchUserPrompt(batch) },
      ],
      temperature: 0.1,
      jsonSchema: {
        name: AUDIT_BATCH_JSON_SCHEMA.name,
        strict: AUDIT_BATCH_JSON_SCHEMA.strict,
        schema: AUDIT_BATCH_JSON_SCHEMA.schema as unknown as Record<
          string,
          unknown
        >,
      },
    });
    const items = parseAuditBatchResponse(result.content);
    const byId = new Map(
      items.filter((i) => i.id).map((i) => [i.id!, i] as const),
    );

    const cases = batch.map((mapped, idx) => {
      const response =
        byId.get(mapped.id) ??
        items[idx] ??
        null;
      if (!response) {
        return auditPassthrough(
          mapped,
          "Auditoría: sin ítem en respuesta del batch",
        );
      }
      return applyAuditResponse(mapped, response, result.model);
    });
    return { cases, model: result.model };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      cases: batch.map((m) =>
        auditPassthrough(m, `Auditoría omitida: ${msg}`),
      ),
    };
  }
}

async function runBatches(
  cases: MappedCase[],
  onProgress: (done: number, label: string, caseId?: string) => void,
): Promise<AuditedCase[]> {
  const batches = chunk(cases, AUDIT_BATCH_SIZE);
  const results = new Array<AuditedCase>(cases.length);
  let nextBatch = 0;
  let doneCases = 0;

  async function worker(): Promise<void> {
    while (true) {
      if (cancelRequested) return;
      const bi = nextBatch;
      nextBatch += 1;
      if (bi >= batches.length) return;
      const batch = batches[bi]!;
      const startIndex = bi * AUDIT_BATCH_SIZE;
      onProgress(
        doneCases,
        `Gemini batch ${bi + 1}/${batches.length} (${batch.length} casos)…`,
        batch[0]?.id,
      );
      const { cases: audited, model } = await auditBatch(batch);
      if (cancelRequested) return;
      for (let i = 0; i < audited.length; i += 1) {
        results[startIndex + i] = audited[i]!;
        doneCases += 1;
        onProgress(
          doneCases,
          `Auditado ${doneCases}/${cases.length}${model ? ` · ${model}` : ""} · ${audited[i]!.folderName}`,
          audited[i]!.id,
        );
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(BATCH_CONCURRENCY, Math.max(1, batches.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results.filter(Boolean);
}

export function registerStage3Ipc(): void {
  ipcMain.handle(IPC.AUDIT_STATUS, async (): Promise<AuditStatusResult> => {
    return { configured: isGeminiConfigured() };
  });

  ipcMain.handle(IPC.AUDIT_CANCEL, async (): Promise<{ ok: true }> => {
    cancelRequested = true;
    broadcastProgress({
      done: 0,
      total: 0,
      label: "Cancelando auditoría…",
      cancelled: true,
    });
    return { ok: true };
  });

  ipcMain.handle(
    IPC.AUDIT_MAPPED_CASES,
    async (
      _evt,
      casesRaw: unknown,
      optionsRaw?: unknown,
    ): Promise<AuditCasesResult> => {
      cancelRequested = false;

      if (!Array.isArray(casesRaw) || casesRaw.length === 0) {
        return { ok: false, error: "No hay casos para auditar" };
      }
      if (!casesRaw.every(isMappedCase)) {
        return { ok: false, error: "Payload de casos inválido" };
      }

      const options = (optionsRaw ?? {}) as AuditMappedCasesOptions;
      const cases = casesRaw as MappedCase[];
      const started = Date.now();
      const total = cases.length;
      const skipAi = Boolean(options.skipAi) || !isGeminiConfigured();

      if (skipAi && !options.skipAi && !isGeminiConfigured()) {
        // Auto local mode when no key — still succeeds with heuristic
        broadcastProgress({
          done: 0,
          total,
          label: `${geminiConfigHint()} · aplicando heurística local…`,
        });
      }

      if (skipAi) {
        broadcastProgress({
          done: 0,
          total,
          label: options.skipAi
            ? `Auditoría local (${total} casos)…`
            : `Sin Gemini — heurística local (${total} casos)…`,
        });

        const audited: AuditedCase[] = [];
        for (let i = 0; i < cases.length; i += 1) {
          if (cancelRequested) {
            return {
              ok: false,
              error: "Auditoría cancelada",
              cancelled: true,
            };
          }
          const note = options.skipAi
            ? "Continuar sin IA"
            : "sin GEMINI_API_KEY";
          audited.push(auditWithLocalHeuristic(cases[i]!, note));
          if (i % 10 === 0 || i === cases.length - 1) {
            broadcastProgress({
              done: i + 1,
              total,
              label: `Local ${i + 1}/${total} · ${cases[i]!.folderName}`,
              currentCaseId: cases[i]!.id,
            });
          }
        }

        const correctedCount = audited.filter((c) => c.correctionsApplied).length;
        const durationMs = Date.now() - started;
        broadcastProgress({
          done: total,
          total,
          label: `Listo (local) en ${(durationMs / 1000).toFixed(1)}s · ${correctedCount} corrección(es)`,
        });
        return {
          ok: true,
          cases: audited,
          durationMs,
          correctedCount,
          mode: "local",
        };
      }

      broadcastProgress({
        done: 0,
        total,
        label: `Auditando mapeo con Gemini (${total} casos, batches de ${AUDIT_BATCH_SIZE})…`,
      });

      try {
        const audited = await runBatches(cases, (done, label, caseId) => {
          broadcastProgress({
            done,
            total,
            label,
            currentCaseId: caseId,
            cancelled: cancelRequested,
          });
        });

        if (cancelRequested) {
          return {
            ok: false,
            error: "Auditoría cancelada",
            cancelled: true,
          };
        }

        // Completar huecos si cancel parcial
        const complete = audited.length === total
          ? audited
          : cases.map((c, i) => audited[i] ?? auditPassthrough(c, "sin resultado"));

        const correctedCount = complete.filter((c) => c.correctionsApplied).length;
        const durationMs = Date.now() - started;

        broadcastProgress({
          done: total,
          total,
          label: `Auditoría lista en ${(durationMs / 1000).toFixed(1)}s · ${correctedCount} corrección(es)`,
        });

        return {
          ok: true,
          cases: complete,
          durationMs,
          correctedCount,
          mode: "gemini",
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
}
