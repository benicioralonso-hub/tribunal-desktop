export type MappedPdfKind = "caso" | "informe" | "otro";

export type MappedCase = {
  id: string;
  folderPath: string;
  folderName: string;
  casoPdfPath: string | null;
  informePdfPath: string | null;
  homeClub: string | null;
  awayClub: string | null;
  person: string | null;
  club: string | null;
  role: string | null;
  matchDate: string | null;
  competition: string | null;
  confidence: number;
  engine: "classical" | "audited";
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
