import { useEffect, useState, useTransition } from "react";
import { getTribunalApi } from "../bridge/api";
import type { MappedCase } from "../../shared/map/types";

type Props = {
  folderPath: string;
  onBack: () => void;
  onContinue: (cases: MappedCase[]) => void;
};

export function StageMap({ folderPath, onBack, onContinue }: Props) {
  const [pending, startTransition] = useTransition();
  const [cases, setCases] = useState<MappedCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [meta, setMeta] = useState<{ pdfCount: number; durationMs: number } | null>(
    null,
  );
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const api = getTribunalApi();
    return api.onMapProgress((ev) => {
      setProgress({ done: ev.done, total: ev.total });
    });
  }, []);

  function runMap() {
    setError(null);
    setCases([]);
    setMeta(null);
    setStarted(true);
    setProgress({ done: 0, total: 0 });
    startTransition(async () => {
      try {
        const result = await getTribunalApi().mapBoletinFolder(folderPath);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setCases(result.cases);
        setMeta({ pdfCount: result.pdfCount, durationMs: result.durationMs });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  useEffect(() => {
    if (!started) runMap();
    // auto-start once when entering stage 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mappedOk = cases.filter((c) => c.person || c.homeClub).length;

  return (
    <section className="stage-select stage-map" aria-labelledby="stage2-title">
      <h2 id="stage2-title">Mapeo de alta velocidad</h2>
      <p className="lede">
        Workers Node parsean los PDF en paralelo y extraen local, visitante,
        infractor y rol.
      </p>
      <p className="folder-path">{folderPath}</p>

      <div className="cta-row">
        <button
          type="button"
          className="btn-primary"
          onClick={runMap}
          disabled={pending}
        >
          {pending ? "Mapeando…" : started ? "Volver a mapear" : "Iniciar mapeo"}
        </button>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Volver
        </button>
        {cases.length > 0 ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onContinue(cases)}
          >
            Continuar a auditoría
          </button>
        ) : null}
      </div>

      {pending || progress.total > 0 ? (
        <p className="status-msg" data-tone="ok">
          {progress.total > 0
            ? `Progreso: ${progress.done} / ${progress.total} PDF`
            : "Preparando workers…"}
          {meta
            ? ` · ${meta.pdfCount} PDF · ${(meta.durationMs / 1000).toFixed(1)}s · ${mappedOk} casos con datos`
            : null}
        </p>
      ) : null}

      {error ? <p className="status-msg">{error}</p> : null}

      {cases.length > 0 ? (
        <div className="map-table-wrap">
          <table className="map-table">
            <thead>
              <tr>
                <th>Partido / carpeta</th>
                <th>Local</th>
                <th>Visitante</th>
                <th>Infractor</th>
                <th>Rol</th>
                <th>Club</th>
                <th>Fecha</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} data-error={Boolean(c.error)}>
                  <td title={c.folderPath}>{c.folderName}</td>
                  <td>{c.homeClub ?? "—"}</td>
                  <td>{c.awayClub ?? "—"}</td>
                  <td>{c.person ?? (c.error ? `Error: ${c.error}` : "—")}</td>
                  <td>{c.role ?? "—"}</td>
                  <td>{c.club ?? "—"}</td>
                  <td>{c.matchDate ?? "—"}</td>
                  <td>{c.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
