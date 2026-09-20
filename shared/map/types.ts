import type { FalloDraft } from "../fallo/types";

export type MappedPdfKind = "caso" | "informe" | "otro";

export type AttachmentKind = "descargo" | "nota" | "otro";

export type MappedAttachment = {
  id: string;
  name: string;
  path: string;
  kind: AttachmentKind;
  /** Default false — adjuntos opcionales apagados hasta que el usuario los active. */
  included: boolean;
};

export type { FalloDraft };

export type MappedCase = {
  id: string;
  folderPath: string;
  folderName: string;
  casoPdfPath: string | null;
  informePdfPath: string | null;
  /** Expediente extraído del nombre de carpeta de partido. */
  expediente: string | null;
  homeClub: string | null;
  awayClub: string | null;
  person: string | null;
  club: string | null;
  role: string | null;
  matchDate: string | null;
  competition: string | null;
  /** Valor crudo de «Tipo de evento» del CASO. */
  tipoEvento: string | null;
  /**
   * Carpeta raíz / categoría del boletín
   * (p.ej. "0001 PRIMERA LPF") derivada de folderPath.
   */
  categoryRoot: string | null;
  confidence: number;
  engine: "classical" | "audited";
  /** p.ej. "Alerta: este informe no tiene caso" */
  warning: string | null;
  /** Borrador del fallo generado al mapear (modo manual automático). */
  draft: FalloDraft | null;
  /** Si false, el caso se excluye del procesamiento final. Default true. */
  included: boolean;
  /** Si false, el informe del partido se excluye. Default true. */
  informeIncluded: boolean;
  /** PDFs auxiliares de la carpeta (descargos, notas, otros). */
  attachments: MappedAttachment[];
  error?: string;
};

export type MapProgressPhase =
  | "scanning"
  | "starting"
  | "mapping"
  | "merging"
  | "done";

export type MapProgressEvent = {
  phase: MapProgressPhase;
  /** PDFs terminados */
  done: number;
  /** Total de PDFs a procesar (0 mientras escanea) */
  total: number;
  /** Mensaje legible para la UI */
  label: string;
  /** Ruta o nombre del PDF actual */
  currentPath?: string;
  /** Cantidad de workers del pool */
  workerCount?: number;
};

export type MapFolderResult =
  | { ok: true; cases: MappedCase[]; pdfCount: number; durationMs: number }
  | { ok: false; error: string };
