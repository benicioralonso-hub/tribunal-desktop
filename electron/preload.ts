import { contextBridge, ipcRenderer } from "electron";
import {
  IPC,
  type SelectBoletinResult,
  type MapFolderResult,
  type MapProgressEvent,
  type AuditCasesResult,
  type AuditProgressEvent,
  type AuditStatusResult,
  type AuditMappedCasesOptions,
  type ExportDocxResult,
  type MappedCase,
  type AuditedCase,
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
  getAuditStatus: (): Promise<AuditStatusResult> =>
    ipcRenderer.invoke(IPC.AUDIT_STATUS),
  cancelAudit: (): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC.AUDIT_CANCEL),
  auditMappedCases: (
    cases: MappedCase[],
    options?: AuditMappedCasesOptions,
  ): Promise<AuditCasesResult> =>
    ipcRenderer.invoke(IPC.AUDIT_MAPPED_CASES, cases, options ?? {}),
  onAuditProgress: (cb: (ev: AuditProgressEvent) => void): (() => void) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      payload: AuditProgressEvent,
    ) => cb(payload);
    ipcRenderer.on(IPC.AUDIT_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC.AUDIT_PROGRESS, listener);
  },
  exportBoletinDocx: (cases: AuditedCase[]): Promise<ExportDocxResult> =>
    ipcRenderer.invoke(IPC.EXPORT_BOLETIN_DOCX, cases),
};

contextBridge.exposeInMainWorld("tribunal", tribunalApi);

export type TribunalApi = typeof tribunalApi;
