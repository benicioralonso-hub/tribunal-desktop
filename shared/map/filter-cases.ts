/**
 * Filtros de lista de partidos (FASE 3).
 */
import type { MappedCase } from "./types";

export type CaseListFilters = {
  categoryRoot: string;
  competition: string;
  query: string;
};

export function emptyCaseListFilters(): CaseListFilters {
  return { categoryRoot: "", competition: "", query: "" };
}

export function uniqueCategoryRoots(cases: MappedCase[]): string[] {
  const set = new Set<string>();
  for (const c of cases) {
    if (c.categoryRoot?.trim()) set.add(c.categoryRoot.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function uniqueCompetitions(cases: MappedCase[]): string[] {
  const set = new Set<string>();
  for (const c of cases) {
    if (c.competition?.trim()) set.add(c.competition.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

function matchesQuery(c: MappedCase, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("es-AR");
  if (!q) return true;
  const hay = [
    c.person,
    c.club,
    c.homeClub,
    c.awayClub,
    c.expediente,
    c.folderName,
    c.tipoEvento,
    c.competition,
    c.categoryRoot,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("es-AR");
  return hay.includes(q);
}

export function filterMappedCases(
  cases: MappedCase[],
  filters: CaseListFilters,
): MappedCase[] {
  const cat = filters.categoryRoot.trim();
  const comp = filters.competition.trim();
  return cases.filter((c) => {
    if (cat && (c.categoryRoot || "") !== cat) return false;
    if (comp && (c.competition || "") !== comp) return false;
    if (!matchesQuery(c, filters.query)) return false;
    return true;
  });
}
