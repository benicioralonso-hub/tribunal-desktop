import { contextBridge, ipcRenderer } from "electron";
import {
  IPC,
  type SelectBoletinResult,
  type MapFolderResult,
  type MapProgressEvent,
} from "./ipc/channels";

const tribunalApi = {
  selectBoletinFolder: (): Promise<SelectBoletinResult> =>
    ipcRenderer.invoke(IPC.SELECT_BOLETIN_FOLDER),
  listBoletinFiles: (folderPath: string): Promise<SelectBoletinResult> =>
    ipcRenderer.invoke(IPC.LIST_BOLETIN_FILES, folderPath),
  mapBoletinFolder: (folderPath: string): Promise<MapFolderResult> =>
    ipcRenderer.invoke(IPC.MAP_BOLETIN_FOLDER, folderPath),
  onMapProgress: (cb: (ev: MapProgressEvent) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: MapProgressEvent) =>
      cb(payload);
    ipcRenderer.on(IPC.MAP_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC.MAP_PROGRESS, listener);
  },
};

contextBridge.exposeInMainWorld("tribunal", tribunalApi);

export type TribunalApi = typeof tribunalApi;
