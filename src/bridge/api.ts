import type { TribunalApi } from "../../electron/preload";
import type {
  SelectBoletinResult,
  MapFolderResult,
  MapProgressEvent,
} from "../../electron/ipc/channels";
import { installBrowserMock } from "./browser-mock";

export type { SelectBoletinResult, MapFolderResult, MapProgressEvent };

declare global {
  interface Window {
    tribunal: TribunalApi;
  }
}

export function getTribunalApi(): TribunalApi {
  if (!window.tribunal) {
    // Browser / Cloud preview: install demo mock instead of failing hard.
    installBrowserMock();
  }
  if (!window.tribunal) {
    throw new Error(
      "API nativa no disponible. Abrí la app con Electron (npm run dev).",
    );
  }
  return window.tribunal;
}
