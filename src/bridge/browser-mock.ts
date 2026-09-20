import type { TribunalApi } from "../../electron/preload";
import type { BoletinFileEntry } from "../../electron/ipc/channels";
import type { MappedCase, MapProgressEvent } from "../../shared/map/types";
import type {
  AuditedCase,
  AuditProgressEvent,
} from "../../shared/ai/audit-types";
import { auditWithLocalHeuristic } from "../../shared/ai/apply-audit-response";
import { buildFalloDraft, WARNING_SIN_CASO } from "../../shared/fallo/build-draft";

const DEMO_FOLDER = "/demo/boletin-preview";

const DEMO_FILES: BoletinFileEntry[] = [
  {
    name: "0001",
    absolutePath: `${DEMO_FOLDER}/0001`,
    size: 0,
    isDirectory: true,
    ext: "",
  },
  {
    name: "River Plate c. Boca Juniors 99.523",
    absolutePath: `${DEMO_FOLDER}/0001/River Plate c. Boca Juniors 99.523`,
    size: 0,
    isDirectory: true,
    ext: "",
  },
  {
    name: "CASO.pdf",
    absolutePath: `${DEMO_FOLDER}/0001/River Plate c. Boca Juniors 99.523/CASO.pdf`,
    size: 12_480,
    isDirectory: false,
    ext: ".pdf",
  },
  {
    name: "INFORME.pdf",
    absolutePath: `${DEMO_FOLDER}/0001/River Plate c. Boca Juniors 99.523/INFORME.pdf`,
    size: 8_192,
    isDirectory: false,
    ext: ".pdf",
  },
];

function demoCase(partial: Omit<MappedCase, "draft" | "warning" | "engine" | "tipoEvento"> & {
  warning?: string | null;
  missingCaso?: boolean;
  dobleAmonestacion?: boolean;
  tipoEvento?: string | null;
}): MappedCase {
  const draft = buildFalloDraft({
    expediente: partial.expediente,
    homeClub: partial.homeClub,
    awayClub: partial.awayClub,
    matchDate: partial.matchDate,
    competition: partial.competition,
    folderName: partial.folderName,
    missingCaso: partial.missingCaso,
    persons: partial.missingCaso
      ? []
      : [
          {
            person: partial.person,
            club: partial.club,
            role: partial.role,
            dobleAmonestacion: partial.dobleAmonestacion,
            tipoEvento: partial.tipoEvento,
          },
        ],
  });
  return {
    ...partial,
    tipoEvento: partial.tipoEvento ?? null,
    engine: "classical",
    warning: partial.warning ?? null,
    draft,
  };
}

const DEMO_CASES: MappedCase[] = [
  demoCase({
    id: "demo-1",
    folderPath: `${DEMO_FOLDER}/0001/River Plate c. Boca Juniors 99.523`,
    folderName: "River Plate c. Boca Juniors 99.523",
    casoPdfPath: `${DEMO_FOLDER}/0001/River Plate c. Boca Juniors 99.523/CASO.pdf`,
    informePdfPath: `${DEMO_FOLDER}/0001/River Plate c. Boca Juniors 99.523/INFORME.pdf`,
    expediente: "99.523",
    homeClub: "River Plate",
    awayClub: "Boca Juniors",
    person: "Juan Pérez",
    club: "River Plate",
    role: "Jugador",
    matchDate: "15/03/2026",
    competition: "Torneo Preview",
    confidence: 0.92,
    tipoEvento: "Tarjeta roja - Juego brusco grave",
  }),
  demoCase({
    id: "demo-2",
    folderPath: `${DEMO_FOLDER}/0001/Argentinos Juniors - Centro Asturiano 88.100`,
    folderName: "Argentinos Juniors - Centro Asturiano 88.100",
    casoPdfPath: `${DEMO_FOLDER}/0001/Argentinos Juniors - Centro Asturiano 88.100/CASO.pdf`,
    informePdfPath: `${DEMO_FOLDER}/0001/Argentinos Juniors - Centro Asturiano 88.100/INFORME.pdf`,
    expediente: "88.100",
    homeClub: "Argentinos Juniors",
    awayClub: "Centro Asturiano",
    person: "Camila Rosario Bianchini",
    club: "Centro Asturiano",
    role: "Jugadora",
    matchDate: "22/08/2026",
    competition: "Futsal Femenino Preview",
    confidence: 0.88,
    dobleAmonestacion: true,
    tipoEvento: "Tarjeta amarilla - Desaprobar con palabras o acciones",
  }),
  demoCase({
    id: "demo-3",
    folderPath: `${DEMO_FOLDER}/0002/Independiente c. Racing 77.200`,
    folderName: "Independiente c. Racing 77.200",
    casoPdfPath: null,
    informePdfPath: `${DEMO_FOLDER}/0002/Independiente c. Racing 77.200/INFORME.pdf`,
    expediente: "77.200",
    homeClub: "Independiente",
    awayClub: "Racing",
    person: null,
    club: null,
    role: null,
    matchDate: "10/03/2026",
    competition: "Torneo Preview",
    confidence: 0.7,
    warning: WARNING_SIN_CASO,
    missingCaso: true,
  }),
  demoCase({
    id: "demo-4",
    folderPath: `${DEMO_FOLDER}/0002/San Lorenzo c. Huracán 66.010`,
    folderName: "San Lorenzo c. Huracán 66.010",
    casoPdfPath: `${DEMO_FOLDER}/0002/San Lorenzo c. Huracán 66.010/CASO.pdf`,
    informePdfPath: `${DEMO_FOLDER}/0002/San Lorenzo c. Huracán 66.010/INFORME.pdf`,
    expediente: "66.010",
    homeClub: "San Lorenzo",
    awayClub: "Huracán",
    person: "Pedro Gómez",
    club: "San Lorenzo",
    role: "Jugador",
    matchDate: "05/04/2026",
    competition: "Torneo Preview",
    confidence: 0.75,
    tipoEvento:
      "Tarjeta roja - Emplear lenguaje ofensivo, grosero u obsceno y/o gestos de la misma naturaleza",
  }),
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
      const total = 4;
      const phases: MapProgressEvent[] = [
        {
          phase: "scanning",
          done: 0,
          total: 0,
          label: "Escaneando carpeta del boletín…",
        },
        {
          phase: "starting",
          done: 0,
          total,
          label: "Arrancando 4 workers locales…",
          workerCount: 4,
        },
        {
          phase: "mapping",
          done: 1,
          total,
          label: "Extrayendo · INFORME.pdf",
          workerCount: 4,
        },
        {
          phase: "mapping",
          done: 3,
          total,
          label: "Listo 3/4 · CASO.pdf",
          workerCount: 4,
        },
        {
          phase: "merging",
          done: total,
          total,
          label: "Emparejando CASO + INFORME y redactando borradores…",
          workerCount: 4,
        },
        {
          phase: "done",
          done: total,
          total,
          label: "Mapeo listo en 0.4s",
          workerCount: 4,
        },
      ];
      for (const ev of phases) {
        await new Promise((r) => setTimeout(r, 90 + Math.random() * 60));
        for (const cb of mapProgressListeners) cb(ev);
      }
      return {
        ok: true,
        cases: DEMO_CASES,
        pdfCount: total,
        durationMs: 420,
      };
    },
    onMapProgress: (cb) => {
      mapProgressListeners.add(cb);
      return () => {
        mapProgressListeners.delete(cb);
      };
    },
    getAuditStatus: async () => ({ configured: false }),
    cancelAudit: async () => {
      auditCancel = true;
      return { ok: true };
    },
    auditMappedCases: async (cases, options) => {
      auditCancel = false;
      const t0 = performance.now();
      const out: AuditedCase[] = [];
      for (let i = 0; i < cases.length; i += 1) {
        if (auditCancel) {
          return {
            ok: false,
            error: "Auditoría cancelada",
            cancelled: true,
          };
        }
        const c = cases[i]!;
        for (const cb of auditProgressListeners) {
          cb({
            done: i,
            total: cases.length,
            label: `Auditando · ${c.person ?? c.folderName}`,
            currentCaseId: c.id,
          });
        }
        await new Promise((r) => setTimeout(r, 70));
        out.push(
          options?.skipAi
            ? auditWithLocalHeuristic(c)
            : auditWithLocalHeuristic(c, "mock-local"),
        );
      }
      for (const cb of auditProgressListeners) {
        cb({
          done: cases.length,
          total: cases.length,
          label: "Auditoría lista",
        });
      }
      return {
        ok: true,
        cases: out,
        durationMs: Math.round(performance.now() - t0),
        correctedCount: out.filter((c) => c.correctionsApplied).length,
        mode: "local",
      };
    },
    onAuditProgress: (cb) => {
      auditProgressListeners.add(cb);
      return () => {
        auditProgressListeners.delete(cb);
      };
    },
    exportBoletinDocx: async () => ({
      ok: true,
      filePath: "/demo/boletin-preview/Boletin-preview.docx",
      durationMs: 120,
    }),
  };

  window.tribunal = api;
}
