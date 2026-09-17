import { Worker } from "node:worker_threads";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkerJob, WorkerResult } from "./pdf-map.worker";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function workerScriptPath(): string {
  // electron-vite emite workers junto al main bundle
  return path.join(__dirname, "pdf-map.worker.js");
}

export class PdfMapPool {
  private readonly size: number;
  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly waiters: Array<(w: Worker) => void> = [];
  private readonly pending = new Map<
    string,
    { resolve: (r: WorkerResult) => void; worker: Worker }
  >();

  constructor(size = Math.max(1, os.cpus().length)) {
    this.size = size;
    for (let i = 0; i < this.size; i += 1) {
      const w = new Worker(workerScriptPath());
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

  private release(w: Worker): void {
    const next = this.waiters.shift();
    if (next) next(w);
    else this.idle.push(w);
  }

  async run(job: WorkerJob): Promise<WorkerResult> {
    const worker = await this.acquire();
    return new Promise<WorkerResult>((resolve) => {
      this.pending.set(job.id, { resolve, worker });
      worker.postMessage(job);
    });
  }

  async mapAll(
    jobs: WorkerJob[],
    onProgress?: (done: number, total: number, path?: string) => void,
  ): Promise<WorkerResult[]> {
    const total = jobs.length;
    let done = 0;
    const results = await Promise.all(
      jobs.map(async (job) => {
        const result = await this.run(job);
        done += 1;
        onProgress?.(done, total, job.pdfPath);
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
