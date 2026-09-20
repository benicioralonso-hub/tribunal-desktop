/**
 * Mapeo clásico COMET (sin IA): delega en extractCometFacts.
 * Autocontenido para Electron workers.
 */

import { extractCometFacts } from "./comet-extract";
import { parseMatchFolderName } from "./sanitize";

export type MapFacts = {
  person: string | null;
  club: string | null;
  role: string | null;
  homeClub: string | null;
  awayClub: string | null;
  matchDate: string | null;
  competition: string | null;
  kind: "caso" | "informe" | "otro";
  confidence: number;
  /** Señales COMET (p.ej. doble_amonestacion). */
  signals?: string[];
};

export function classifyPdfText(text: string): "caso" | "informe" | "otro" {
  const t = text.toLowerCase();
  if (/informe\s+del\s+partido|match\s+report/.test(t)) return "informe";
  if (
    /caso\s+disciplinari|decisi[oó]n\s+de\s+caso|infractor\s*:/.test(t)
  ) {
    return "caso";
  }
  return "otro";
}

export function mapFactsFromText(
  text: string,
  hints?: { folderName?: string; fileName?: string },
): MapFacts {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  const kind = classifyPdfText(normalized);
  const comet = extractCometFacts(normalized, {
    matchFolder: hints?.folderName,
    fileName: hints?.fileName,
  });

  return {
    person: comet.person,
    club: comet.club,
    role: comet.role,
    homeClub: comet.homeClub,
    awayClub: comet.awayClub,
    matchDate: comet.matchDate,
    competition: comet.competition,
    kind,
    confidence: comet.confidence,
    signals: comet.signals,
  };
}

/**
 * Preferencias de fuente:
 * - INFORME → local / visitante / fecha / disciplina
 * - CASO → infractor / rol / club
 * - Carpeta → fallback de clubs (+ expediente aparte)
 */
export function mergeCasoInforme(
  caso: MapFacts | null,
  informe: MapFacts | null,
  folderName: string,
): Omit<MapFacts, "kind"> {
  const folder = parseMatchFolderName(folderName);
  return {
    person: caso?.person || null,
    club: caso?.club || null,
    role: caso?.role || null,
    homeClub:
      informe?.homeClub || caso?.homeClub || folder.homeClub || null,
    awayClub:
      informe?.awayClub || caso?.awayClub || folder.awayClub || null,
    matchDate: informe?.matchDate || caso?.matchDate || null,
    competition: informe?.competition || caso?.competition || null,
    confidence: Math.max(caso?.confidence ?? 0, informe?.confidence ?? 0),
    signals: caso?.signals?.length
      ? caso.signals
      : informe?.signals?.length
        ? informe.signals
        : undefined,
  };
}
