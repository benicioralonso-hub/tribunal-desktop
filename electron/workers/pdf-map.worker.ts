import { parentPort } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractTextFromPdf } from "../../shared/pdf/extract-text";
import { mapFactsFromText } from "../../shared/map/map-from-text";

export type WorkerJob = {
  id: string;
  pdfPath: string;
  folderName: string;
};

export type WorkerResult =
  | {
      id: string;
      pdfPath: string;
      ok: true;
      textLen: number;
      facts: ReturnType<typeof mapFactsFromText>;
    }
  | {
      id: string;
      pdfPath: string;
      ok: false;
      error: string;
    };

if (!parentPort) {
  throw new Error("pdf-map.worker debe correr en worker_threads");
}

// Precarga unpdf al arrancar el worker (evita cold-start en el 1º PDF)
void import("unpdf").catch(() => undefined);

parentPort.on("message", async (job: WorkerJob) => {
  try {
    const bytes = await readFile(job.pdfPath);
    const text = await extractTextFromPdf(bytes);
    const facts = mapFactsFromText(text, {
      folderName: job.folderName,
      fileName: path.basename(job.pdfPath),
    });
    const result: WorkerResult = {
      id: job.id,
      pdfPath: job.pdfPath,
      ok: true,
      textLen: text.length,
      facts,
    };
    parentPort!.postMessage(result);
  } catch (err) {
    const result: WorkerResult = {
      id: job.id,
      pdfPath: job.pdfPath,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort!.postMessage(result);
  }
});
