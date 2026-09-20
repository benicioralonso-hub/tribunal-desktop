/** Tipos de tipificación / borrador alineados a tribunal-app. */

export type SanctionKind =
  | "suspension_partidos"
  | "suspension_con_multa_ve"
  | "multa_club"
  | "multa_club_plazo"
  | "dar_vista"
  | "medida_provisional"
  | "medida_autorizada"
  | "suspension_provisional"
  | "dar_por_cumplida"
  | "doble_amonestacion"
  | "archive_sin_tramite"
  | "continuan_actuaciones"
  | "remitir_estadios"
  | "remitir_equidad"
  | "aprueba_medida_autorizada"
  | "otra";

export type FalloDraftStatus =
  | "proposed"
  | "accepted"
  | "modified"
  | "rejected";

export type ResolutionItem = {
  order: number;
  kind: SanctionKind;
  personName: string;
  role: string;
  club: string;
  partidos?: number;
  multaVe?: number;
  multaPesos?: number;
  opponentClub?: string;
  boletinNumber?: string;
  boletinSuffix?: string;
  boletinDate?: string;
  article?: string;
  articles?: string[];
  bodyText: string;
  sourceCaseKey?: string;
};

/**
 * Borrador de fallo (modo manual).
 * `title`/`header` = primera línea; `body` = resoluciones; `fullText` = compuesto.
 */
export type FalloDraft = {
  /** Alias de header (compat UI). */
  title: string;
  header: string;
  body: string;
  fullText: string;
  items: ResolutionItem[];
  confidence: number;
  status: FalloDraftStatus;
  rationale?: string;
  redactorModel?: string | null;
  updatedAt: string;
};
