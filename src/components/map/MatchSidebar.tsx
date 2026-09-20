import { useMemo, useState } from "react";
import type { MappedCase } from "../../shared/map/types";
import {
  emptyCaseListFilters,
  filterMappedCases,
  uniqueCategoryRoots,
  uniqueCompetitions,
  type CaseListFilters,
} from "../../../shared/map/filter-cases";

export type MatchGroup = {
  key: string;
  folderPath: string;
  folderName: string;
  homeClub: string | null;
  awayClub: string | null;
  expediente: string | null;
  warning: string | null;
  categoryRoot: string | null;
  cases: MappedCase[];
};

export function groupCasesByMatch(cases: MappedCase[]): MatchGroup[] {
  const map = new Map<string, MatchGroup>();
  for (const c of cases) {
    const key = c.folderPath || c.id;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        folderPath: c.folderPath,
        folderName: c.folderName,
        homeClub: c.homeClub,
        awayClub: c.awayClub,
        expediente: c.expediente,
        warning: c.warning,
        categoryRoot: c.categoryRoot,
        cases: [],
      };
      map.set(key, g);
    }
    g.cases.push(c);
    if (c.warning) g.warning = c.warning;
    if (!g.homeClub && c.homeClub) g.homeClub = c.homeClub;
    if (!g.awayClub && c.awayClub) g.awayClub = c.awayClub;
    if (!g.expediente && c.expediente) g.expediente = c.expediente;
    if (!g.categoryRoot && c.categoryRoot) g.categoryRoot = c.categoryRoot;
  }
  return [...map.values()];
}

type Props = {
  cases: MappedCase[];
  selectedId: string | null;
  onSelect: (caseId: string) => void;
  onDebug: (caseItem: MappedCase) => void;
};

export function MatchSidebar({
  cases,
  selectedId,
  onSelect,
  onDebug,
}: Props) {
  const [filters, setFilters] = useState<CaseListFilters>(emptyCaseListFilters);

  const categories = useMemo(() => uniqueCategoryRoots(cases), [cases]);
  const competitions = useMemo(() => uniqueCompetitions(cases), [cases]);
  const filtered = useMemo(
    () => filterMappedCases(cases, filters),
    [cases, filters],
  );
  const groups = useMemo(() => groupCasesByMatch(filtered), [filtered]);
  const total = filtered.length;

  return (
    <aside className="match-sidebar glass-panel" aria-label="Partidos mapeados">
      <div className="match-sidebar-header">
        <h3>Partidos</h3>
        <p>
          {groups.length} partido{groups.length === 1 ? "" : "s"} · {total} caso
          {total === 1 ? "" : "s"}
        </p>
      </div>

      <div className="match-filters" aria-label="Filtros">
        <label>
          Carpeta / categoría
          <select
            value={filters.categoryRoot}
            onChange={(e) =>
              setFilters((f) => ({ ...f, categoryRoot: e.target.value }))
            }
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Disciplina / división
          <select
            value={filters.competition}
            onChange={(e) =>
              setFilters((f) => ({ ...f, competition: e.target.value }))
            }
          >
            <option value="">Todas</option>
            {competitions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input
            type="search"
            placeholder="Infractor, club, expte…"
            value={filters.query}
            onChange={(e) =>
              setFilters((f) => ({ ...f, query: e.target.value }))
            }
          />
        </label>
      </div>

      <ul className="match-sidebar-list">
        {groups.length === 0 ? (
          <li className="match-empty">Ningún caso con estos filtros.</li>
        ) : (
          groups.flatMap((g, gi) =>
            g.cases.map((c, ci) => {
              const label =
                c.homeClub && c.awayClub
                  ? `${c.homeClub} c. ${c.awayClub}`
                  : c.folderName;
              const sub = c.person
                ? c.person
                : c.warning
                  ? "Sin caso"
                  : "Sin infractor";
              const delay = Math.min(gi * 40 + ci * 35, 420);
              return (
                <li key={c.id}>
                  <div
                    className="match-card-wrap"
                    data-active={c.id === selectedId}
                  >
                    <button
                      type="button"
                      className="match-card"
                      data-active={c.id === selectedId}
                      data-warn={Boolean(c.warning)}
                      data-tipify={c.draft?.status === "sin_tipificar"}
                      style={{ animationDelay: `${delay}ms` }}
                      onClick={() => onSelect(c.id)}
                    >
                      <span className="match-card-title">{label}</span>
                      <span className="match-card-meta">
                        <span>{sub}</span>
                        {c.categoryRoot ? (
                          <span className="match-cat">{c.categoryRoot}</span>
                        ) : null}
                        {c.expediente ? <span>Exp. {c.expediente}</span> : null}
                        {c.draft?.status === "sin_tipificar" ? (
                          <span className="tipify-badge-sm">
                            ⚠️ Requiere Tipificación Manual
                          </span>
                        ) : null}
                        {c.warning ? (
                          <span className="warn-badge">Sin caso</span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="match-debug-btn"
                      title="Debug JSON"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDebug(c);
                      }}
                    >
                      Debug JSON
                    </button>
                  </div>
                </li>
              );
            }),
          )
        )}
      </ul>
    </aside>
  );
}
