import { Worker } from "node:worker_threads";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkerJob, WorkerResult } from "./pdf-map.worker";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function workerScriptPath(): string {
  return path.join(__dirname, "pdf-map.worker.js");
}

/**
 * Pool agresivo local: escala con CPU y RAM libre.
 * ~2–3× núcleos (tope 48). Más máquina = más PDFs en paralelo, misma calidad.
 */
export function defaultPoolSize(): number {
  const cpus = Math.max(1, os.cpus()?.length ?? 4);
  const freeMemGb = os.freemem() / (1024 ** 3);
  // ~1 worker por ~0.6 GB libres (cada worker puede usar hasta ~768 MB heap)
  const byRam = Math.max(2, Math.floor(freeMemGb / 0.6));
  const byCpu = Math.max(cpus * 2, cpus + 2);
  // Si hay mucha RAM, empujar hasta ~3× CPUs
  const hungry = freeMemGb >= 8 ? Math.max(byCpu, Math.min(cpus * 3, byRam)) : byCpu;
  return Math.min(48, Math.max(2, Math.min(hungry, byRam + cpus)));
}

export class PdfMapPool {
  readonly size: number;
  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly waiters: Array<(w: Worker) => void> = [];
  private readonly pending = new Map<
    string,
    { resolve: (r: WorkerResult) => void; worker: Worker }
  >();

  constructor(size = defaultPoolSize()) {
    this.size = size;
    for (let i = 0; i < this.size; i += 1) {
      const w = new Worker(workerScriptPath(), {
        resourceLimits: {
          maxOldGenerationSizeMb: 768,
          maxYoungGenerationSizeMb: 128,
        },
      });
      w.on("message", (result: WorkerResult) => {
        const entry = this.pending.get(result.id);
        if (!entry) return;
        this.pending.delete(result.id);
        entry.resolve(result);
        this.release(entry.worker);
      });
      w.on("error", (err) => {
        for (const [id, entry] of this.pending) {
          if (entry.worker === w) {
            this.pending.delete(id);
            entry.resolve({
              id,
              pdfPath: "",
              ok: false,
              error: err.message,
            });
          }
        }
        this.release(w);
      });
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  private acquire(): Promise<Worker> {
    const free = this.idle.pop();
    if (free) return Promise.resolve(free);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release(w: Worker) {
    const next = this.waiters.shift();
    if (next) next(w);
    else this.idle.push(w);
  }

  async run(
    job: WorkerJob,
    onStart?: (job: WorkerJob) => void,
  ): Promise<WorkerResult> {
    const worker = await this.acquire();
    onStart?.(job);
    return new Promise<WorkerResult>((resolve) => {
      this.pending.set(job.id, { resolve, worker });
      worker.postMessage(job);
    });
  }

  async mapAll(
    jobs: WorkerJob[],
    onProgress?: (info: {
      done: number;
      total: number;
      currentPath?: string;
      started?: boolean;
    }) => void,
  ): Promise<WorkerResult[]> {
    const total = jobs.length;
    let done = 0;
    const results = await Promise.all(
      jobs.map(async (job) => {
        const result = await this.run(job, (startedJob) => {
          onProgress?.({
            done,
            total,
            currentPath: startedJob.pdfPath,
            started: true,
          });
        });
        done += 1;
        onProgress?.({
          done,
          total,
          currentPath: job.pdfPath,
          started: false,
        });
        return result;
      }),
    );
    return results;
  }

  async destroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers.length = 0;
    this.idle.length = 0;
  }
}
