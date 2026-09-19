import { ipcMain, BrowserWindow } from "electron";
import { readFile } from "node:fs/promises";
import { IPC } from "./channels";
import { extractTextFromPdf } from "../../shared/pdf/extract-text";
import { AUDIT_SYSTEM_PROMPT } from "../../shared/ai/audit-prompt";
import {
  chatJsonCompletion,
  geminiConfigHint,
  isGeminiConfigured,
} from "../../shared/ai/gemini-client";
import { buildAuditUserPrompt } from "../../shared/ai/build-audit-user-prompt";
import {
  applyAuditResponse,
  auditPassthrough,
  parseAuditLlmResponse,
} from "../../shared/ai/apply-audit-response";
import {
  AUDIT_JSON_SCHEMA,
  type AuditedCase,
  type AuditCasesResult,
  type AuditProgressEvent,
} from "../../shared/ai/audit-types";
import type { MappedCase } from "../../shared/map/types";

const CONCURRENCY = 4;

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

async function extractOptionalPdf(
  pdfPath: string | null,
): Promise<string | undefined> {
  if (!pdfPath) return undefined;
  try {
    const bytes = await readFile(pdfPath);
    return await extractTextFromPdf(bytes);
  } catch {
    return undefined;
  }
}

async function auditOneCase(
  mapped: MappedCase,
): Promise<AuditedCase> {
  const [casoText, informeText] = await Promise.all([
    extractOptionalPdf(mapped.casoPdfPath),
    extractOptionalPdf(mapped.informePdfPath),
  ]);

  try {
    const result = await chatJsonCompletion({
      messages: [
        { role: "system", content: AUDIT_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildAuditUserPrompt({ mapped, casoText, informeText }),
        },
      ],
      temperature: 0.1,
      jsonSchema: {
        name: AUDIT_JSON_SCHEMA.name,
        strict: AUDIT_JSON_SCHEMA.strict,
        schema: AUDIT_JSON_SCHEMA.schema as unknown as Record<string, unknown>,
      },
    });
    const parsed = parseAuditLlmResponse(result.content);
    return applyAuditResponse(mapped, parsed, result.model);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return auditPassthrough(mapped, `Auditoría omitida: ${msg}`);
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onDone: (done: number, index: number, item: T) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      const item = items[index]!;
      results[index] = await fn(item, index);
      done += 1;
      onDone(done, index, item);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export function registerStage3Ipc(): void {
  ipcMain.handle(
    IPC.AUDIT_MAPPED_CASES,
    async (_evt, casesRaw: unknown): Promise<AuditCasesResult> => {
      if (!Array.isArray(casesRaw) || casesRaw.length === 0) {
        return { ok: false, error: "No hay casos para auditar" };
      }
      if (!casesRaw.every(isMappedCase)) {
        return { ok: false, error: "Payload de casos inválido" };
      }
      if (!isGeminiConfigured()) {
        return { ok: false, error: geminiConfigHint() };
      }

      const cases = casesRaw as MappedCase[];
      const started = Date.now();
      const total = cases.length;

      broadcastProgress({
        done: 0,
        total,
        label: `Auditando mapeo con Gemini (${total} casos)…`,
      });

      try {
        const audited = await mapPool(
          cases,
          CONCURRENCY,
          (mapped) => auditOneCase(mapped),
          (done, _index, mapped) => {
            broadcastProgress({
              done,
              total,
              label: `Auditado ${done}/${total} · ${mapped.folderName}`,
              currentCaseId: mapped.id,
            });
          },
        );

        const correctedCount = audited.filter((c) => c.correctionsApplied).length;
        const durationMs = Date.now() - started;

        broadcastProgress({
          done: total,
          total,
          label: `Auditoría lista en ${(durationMs / 1000).toFixed(1)}s · ${correctedCount} corrección(es)`,
        });

        return {
          ok: true,
          cases: audited,
          durationMs,
          correctedCount,
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
