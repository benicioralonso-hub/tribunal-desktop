import type { TribunalApi } from "../../electron/preload";
import type { BoletinFileEntry } from "../../electron/ipc/channels";
import type { MappedCase, MapProgressEvent } from "../../shared/map/types";

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

  const progressListeners = new Set<(ev: MapProgressEvent) => void>();

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
      for (let done = 1; done <= total; done++) {
        const ev: MapProgressEvent = {
          done,
          total,
          currentPath: DEMO_FILES[done]?.absolutePath,
        };
        for (const cb of progressListeners) cb(ev);
        await new Promise((r) => setTimeout(r, 120));
      }
      return {
        ok: true,
        cases: DEMO_CASES,
        pdfCount: total,
        durationMs: 280,
      };
    },
    onMapProgress: (cb) => {
      progressListeners.add(cb);
      return () => {
        progressListeners.delete(cb);
      };
    },
  };

  window.tribunal = api;
  console.info(
    "[tribunal-preview] Browser mock API instalada — sin proceso Electron.",
  );
}
