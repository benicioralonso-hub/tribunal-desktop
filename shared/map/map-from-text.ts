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
  };
}

export function mergeCasoInforme(
  caso: MapFacts | null,
  informe: MapFacts | null,
  folderName: string,
): Omit<MapFacts, "kind"> {
  const folder = parseMatchFolderName(folderName);
  return {
    person: caso?.person || informe?.person || null,
    club: caso?.club || informe?.club || null,
    role: caso?.role || informe?.role || null,
    homeClub:
      caso?.homeClub || informe?.homeClub || folder.homeClub || null,
    awayClub:
      caso?.awayClub || informe?.awayClub || folder.awayClub || null,
    matchDate: caso?.matchDate || informe?.matchDate || null,
    competition: caso?.competition || informe?.competition || null,
    confidence: Math.max(caso?.confidence ?? 0, informe?.confidence ?? 0),
  };
}
