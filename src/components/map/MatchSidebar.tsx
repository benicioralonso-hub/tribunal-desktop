import type { MappedCase } from "../../shared/map/types";

export type MatchGroup = {
  key: string;
  folderPath: string;
  folderName: string;
  homeClub: string | null;
  awayClub: string | null;
  expediente: string | null;
  warning: string | null;
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
        cases: [],
      };
      map.set(key, g);
    }
    g.cases.push(c);
    if (c.warning) g.warning = c.warning;
    if (!g.homeClub && c.homeClub) g.homeClub = c.homeClub;
    if (!g.awayClub && c.awayClub) g.awayClub = c.awayClub;
    if (!g.expediente && c.expediente) g.expediente = c.expediente;
  }
  return [...map.values()];
}

type Props = {
  groups: MatchGroup[];
  selectedId: string | null;
  onSelect: (caseId: string) => void;
};

export function MatchSidebar({ groups, selectedId, onSelect }: Props) {
  const total = groups.reduce((n, g) => n + g.cases.length, 0);

  return (
    <aside className="match-sidebar glass-panel" aria-label="Partidos mapeados">
      <div className="match-sidebar-header">
        <h3>Partidos</h3>
        <p>
          {groups.length} partido{groups.length === 1 ? "" : "s"} · {total} caso
          {total === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="match-sidebar-list">
        {groups.flatMap((g, gi) =>
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
              </li>
            );
          }),
        )}
      </ul>
    </aside>
  );
}
