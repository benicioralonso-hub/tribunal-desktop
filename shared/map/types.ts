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
  engine: "classical";
  error?: string;
};

export type MapProgressEvent = {
  done: number;
  total: number;
  currentPath?: string;
};

export type MapFolderResult =
  | { ok: true; cases: MappedCase[]; pdfCount: number; durationMs: number }
  | { ok: false; error: string };
