import type { TribunalApi } from "../../electron/preload";
import type { BoletinFileEntry } from "../../electron/ipc/channels";
import type { MappedCase, MapProgressEvent } from "../../shared/map/types";
import type {
  AuditedCase,
  AuditProgressEvent,
} from "../../shared/ai/audit-types";
import { auditWithLocalHeuristic } from "../../shared/ai/apply-audit-response";

const DEMO_FOLDER = "/demo/boletin-preview";

const DEMO_FILES: BoletinFileEntry[] = [
  {
    name: "Partido-Demo",
    absolutePath: `${DEMO_FOLDER}/Partido-Demo`,
    size: 0,
    isDirectory: true,
    ext: "",
  },
  {
    name: "CASO.pdf",
    absolutePath: `${DEMO_FOLDER}/Partido-Demo/CASO.pdf`,
    size: 12_480,
    isDirectory: false,
    ext: ".pdf",
  },
  {
    name: "INFORME.pdf",
    absolutePath: `${DEMO_FOLDER}/Partido-Demo/INFORME.pdf`,
    size: 8_192,
    isDirectory: false,
    ext: ".pdf",
  },
];

const DEMO_CASES: MappedCase[] = [
  {
    id: "demo-1",
    folderPath: `${DEMO_FOLDER}/Partido-Demo`,
    folderName: "Partido-Demo",
    casoPdfPath: `${DEMO_FOLDER}/Partido-Demo/CASO.pdf`,
    informePdfPath: `${DEMO_FOLDER}/Partido-Demo/INFORME.pdf`,
    homeClub: "Club Atlético Demo",
    awayClub: "Club Visitante Preview",
    person: "Juan Pérez",
    club: "Club Atlético Demo",
    role: "Jugador",
    matchDate: "2026-03-15",
    competition: "Torneo Preview",
    confidence: 0.92,
    engine: "classical",
  },
  {
    id: "demo-2",
    folderPath: `${DEMO_FOLDER}/Partido-Demo-2`,
    folderName: "Partido-Demo-2",
    casoPdfPath: null,
    informePdfPath: null,
    homeClub: "Club A",
    awayClub: "Club B",
    person: "Camila Rosario Bianchini",
    club: "Club A",
    role: "Jugador",
    matchDate: "2026-03-16",
    competition: "Torneo Preview",
    confidence: 0.88,
    engine: "classical",
  },
];

/**
 * Mock `window.tribunal` so the wizard UI is explorable in a browser
 * (Cloud Agent preview / Vite) without the Electron main process.
 */
export function installBrowserMock(): void {
  if (typeof window === "undefined" || window.tribunal) return;

  const mapProgressListeners = new Set<(ev: MapProgressEvent) => void>();
  const auditProgressListeners = new Set<(ev: AuditProgressEvent) => void>();
  let auditCancel = false;

  const api: TribunalApi = {
    selectBoletinFolder: async () => ({
      ok: true,
      folderPath: DEMO_FOLDER,
      files: DEMO_FILES,
    }),
    listBoletinFiles: async () => ({
      ok: true,
      folderPath: DEMO_FOLDER,
      files: DEMO_FILES,
    }),
    mapBoletinFolder: async () => {
      const total = 2;
      const phases: MapProgressEvent[] = [
        {
          phase: "scanning",
          done: 0,
          total: 0,
          label: "Escaneando carpeta del boletín…",
          workerCount: 4,
        },
        {
          phase: "starting",
          done: 0,
          total,
          label: "Arrancando 4 workers locales…",
          workerCount: 4,
        },
      ];
      for (const ev of phases) {
        for (const cb of mapProgressListeners) cb(ev);
        await new Promise((r) => setTimeout(r, 80));
      }
      for (let done = 1; done <= total; done++) {
        const path = DEMO_FILES[done]?.absolutePath;
        for (const cb of mapProgressListeners) {
          cb({
            phase: "mapping",
            done: done - 1,
            total,
            label: `Extrayendo · ${path?.split("/").pop() ?? "PDF"}`,
            currentPath: path,
            workerCount: 4,
          });
        }
        await new Promise((r) => setTimeout(r, 140));
        for (const cb of mapProgressListeners) {
          cb({
            phase: "mapping",
            done,
            total,
            label: `Listo ${done}/${total}`,
            currentPath: path,
            workerCount: 4,
          });
        }
      }
      for (const cb of mapProgressListeners) {
        cb({
          phase: "merging",
          done: total,
          total,
          label: "Emparejando CASO + INFORME…",
          workerCount: 4,
        });
      }
      await new Promise((r) => setTimeout(r, 80));
      return {
        ok: true,
        cases: DEMO_CASES,
        pdfCount: total,
        durationMs: 520,
      };
    },
    onMapProgress: (cb) => {
      mapProgressListeners.add(cb);
      return () => {
        mapProgressListeners.delete(cb);
      };
    },
    getAuditStatus: async () => ({ configured: true }),
    cancelAudit: async () => {
      auditCancel = true;
      return { ok: true };
    },
    auditMappedCases: async (cases, options) => {
      auditCancel = false;
      const list = cases.length > 0 ? cases : DEMO_CASES;
      const total = list.length;
      const skipAi = Boolean(options?.skipAi);

      for (const cb of auditProgressListeners) {
        cb({
          done: 0,
          total,
          label: skipAi
            ? `Auditoría local (${total} casos)…`
            : `Auditando mapeo con Gemini (${total} casos, batches)…`,
        });
      }

      const audited: AuditedCase[] = [];
      for (let i = 0; i < list.length; i += 1) {
        if (auditCancel) {
          return { ok: false, error: "Auditoría cancelada", cancelled: true };
        }
        const c = list[i]!;
        await new Promise((r) => setTimeout(r, 100));
        for (const cb of auditProgressListeners) {
          cb({
            done: i,
            total,
            label: skipAi
              ? `Local ${i + 1}/${total} · ${c.folderName}`
              : `Gemini batch · ${c.folderName}`,
            currentCaseId: c.id,
          });
        }

        if (skipAi) {
          audited.push(auditWithLocalHeuristic(c, "Continuar sin IA"));
        } else if (
          c.role?.toLowerCase() === "jugador" &&
          (c.person?.toLowerCase().includes("camila") ?? false)
        ) {
          audited.push({
            ...c,
            role: "Jugadora",
            engine: "audited",
            auditNotes: ['rol: "Jugador" → "Jugadora" (género)'],
            auditModel: "preview-mock",
            correctionsApplied: true,
          });
        } else {
          audited.push({
            ...c,
            engine: "classical",
            auditNotes: [],
            auditModel: "preview-mock",
            correctionsApplied: false,
          });
        }

        for (const cb of auditProgressListeners) {
          cb({
            done: i + 1,
            total,
            label: `Auditado ${i + 1}/${total} · ${c.folderName}`,
            currentCaseId: c.id,
          });
        }
      }

      const correctedCount = audited.filter((c) => c.correctionsApplied).length;
      const durationMs = 420;
      for (const cb of auditProgressListeners) {
        cb({
          done: total,
          total,
          label: `Auditoría lista en 0.4s · ${correctedCount} corrección(es)`,
        });
      }
      return {
        ok: true,
        cases: audited,
        durationMs,
        correctedCount,
        mode: skipAi ? "local" : "gemini",
      };
    },
    onAuditProgress: (cb) => {
      auditProgressListeners.add(cb);
      return () => {
        auditProgressListeners.delete(cb);
      };
    },
    exportBoletinDocx: async (cases) => {
      await new Promise((r) => setTimeout(r, 200));
      const blob = new Blob(
        [
          `Tribunal Desktop — preview export\nCasos: ${cases.length}\n`,
          ...cases.map(
            (c) =>
              `${c.folderName}\t${c.person ?? ""}\t${c.role ?? ""}\t${c.club ?? ""}\n`,
          ),
        ],
        { type: "text/plain" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "boletin-preview.txt";
      a.click();
      URL.revokeObjectURL(url);
      return {
        ok: true,
        filePath: "/demo/downloads/boletin-preview.txt",
        durationMs: 200,
      };
    },
  };

  window.tribunal = api;
  console.info(
    "[tribunal-preview] Browser mock API instalada — sin proceso Electron.",
  );
}
