import type { TribunalApi } from "../../electron/preload";
import type { BoletinFileEntry } from "../../electron/ipc/channels";
import type { MappedCase, MapProgressEvent } from "../../shared/map/types";
import type {
  AuditedCase,
  AuditProgressEvent,
} from "../../shared/ai/audit-types";

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
];

/**
 * Mock `window.tribunal` so the wizard UI is explorable in a browser
 * (Cloud Agent preview / Vite) without the Electron main process.
 */
export function installBrowserMock(): void {
  if (typeof window === "undefined" || window.tribunal) return;

  const mapProgressListeners = new Set<(ev: MapProgressEvent) => void>();
  const auditProgressListeners = new Set<(ev: AuditProgressEvent) => void>();

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
    auditMappedCases: async (cases) => {
      const total = cases.length || 1;
      for (const cb of auditProgressListeners) {
        cb({
          done: 0,
          total,
          label: `Auditando mapeo con Gemini (${total} casos)…`,
        });
      }
      await new Promise((r) => setTimeout(r, 120));
      for (let done = 1; done <= total; done++) {
        const c = cases[done - 1] ?? DEMO_CASES[0]!;
        for (const cb of auditProgressListeners) {
          cb({
            done: done - 1,
            total,
            label: `Revisando · ${c.folderName}`,
            currentCaseId: c.id,
          });
        }
        await new Promise((r) => setTimeout(r, 180));
        for (const cb of auditProgressListeners) {
          cb({
            done,
            total,
            label: `Auditado ${done}/${total} · ${c.folderName}`,
            currentCaseId: c.id,
          });
        }
      }

      const audited: AuditedCase[] = (cases.length > 0 ? cases : DEMO_CASES).map(
        (c) => {
          // Demo: corrige discordancia de género Jugador → Jugadora
          if (c.role?.toLowerCase() === "jugador") {
            return {
              ...c,
              role: "Jugadora",
              engine: "audited" as const,
              auditNotes: ['rol: "Jugador" → "Jugadora" (género)'],
              auditModel: "preview-mock",
              correctionsApplied: true,
            };
          }
          return {
            ...c,
            engine: "classical" as const,
            auditNotes: [],
            auditModel: "preview-mock",
            correctionsApplied: false,
          };
        },
      );

      const correctedCount = audited.filter((c) => c.correctionsApplied).length;
      const durationMs = 480;
      for (const cb of auditProgressListeners) {
        cb({
          done: total,
          total,
          label: `Auditoría lista en 0.5s · ${correctedCount} corrección(es)`,
        });
      }
      return { ok: true, cases: audited, durationMs, correctedCount };
    },
    onAuditProgress: (cb) => {
      auditProgressListeners.add(cb);
      return () => {
        auditProgressListeners.delete(cb);
      };
    },
  };

  window.tribunal = api;
  console.info(
    "[tribunal-preview] Browser mock API instalada — sin proceso Electron.",
  );
}
