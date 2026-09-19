export const IPC = {
  SELECT_BOLETIN_FOLDER: "stage1:select-boletin-folder",
  LIST_BOLETIN_FILES: "stage1:list-boletin-files",
  MAP_BOLETIN_FOLDER: "stage2:map-boletin-folder",
  MAP_PROGRESS: "stage2:map-progress",
  AUDIT_MAPPED_CASES: "stage3:audit-mapped-cases",
  AUDIT_PROGRESS: "stage3:audit-progress",
} as const;

export type BoletinFileEntry = {
  name: string;
  absolutePath: string;
  size: number;
  isDirectory: boolean;
  ext: string;
};

export type SelectBoletinResult =
  | { ok: true; folderPath: string; files: BoletinFileEntry[] }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

export type {
  MappedCase,
  MapFolderResult,
  MapProgressEvent,
} from "../../shared/map/types";

export type {
  AuditedCase,
  AuditCasesResult,
  AuditProgressEvent,
} from "../../shared/ai/audit-types";
