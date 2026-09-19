import { useEffect, useRef, useState, useTransition } from "react";
import { getTribunalApi } from "../bridge/api";
import { MapBusy } from "../components/MapBusy";
import type { MappedCase, MapProgressEvent } from "../../shared/map/types";

type Props = {
  folderPath: string;
  onBack: () => void;
  onContinue: (cases: MappedCase[]) => void;
};

export function StageMap({ folderPath, onBack, onContinue }: Props) {
  const [pending, startTransition] = useTransition();
  const [cases, setCases] = useState<MappedCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<MapProgressEvent>({
    phase: "scanning",
    done: 0,
    total: 0,
    label: "Listo para mapear",
  });
  const [meta, setMeta] = useState<{
    pdfCount: number;
    durationMs: number;
  } | null>(null);
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<number | null>(null);
  const t0Ref = useRef<number>(0);

  useEffect(() => {
    const api = getTribunalApi();
    return api.onMapProgress((ev) => {
      setProgress(ev);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (tickRef.current != null) window.clearInterval(tickRef.current);
    };
  }, []);

  function stopClock() {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function startClock() {
    stopClock();
    t0Ref.current = performance.now();
    setElapsedMs(0);
    tickRef.current = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - t0Ref.current));
    }, 100);
  }

  function runMap() {
    setError(null);
    setCases([]);
    setMeta(null);
    setStarted(true);
    setProgress({
      phase: "scanning",
      done: 0,
      total: 0,
      label: "Escaneando carpeta del boletín…",
    });
    startClock();
    startTransition(async () => {
      try {
        const result = await getTribunalApi().mapBoletinFolder(folderPath);
        stopClock();
        if (!result.ok) {
          setError(result.error);
          setProgress({
            phase: "done",
            done: 0,
            total: 0,
            label: "Mapeo interrumpido",
          });
          return;
        }
        setElapsedMs(result.durationMs);
        setCases(result.cases);
        setMeta({ pdfCount: result.pdfCount, durationMs: result.durationMs });
        setProgress((prev) => ({
          phase: "done",
          done: result.pdfCount,
          total: result.pdfCount,
          label: `Mapeo listo en ${(result.durationMs / 1000).toFixed(1)}s`,
          workerCount: prev.workerCount,
        }));
      } catch (err) {
        stopClock();
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
  const running = pending || progress.phase !== "done";

  return (
    <section className="stage-select stage-map" aria-labelledby="stage2-title">
      <h2 id="stage2-title">Mapeo de alta velocidad</h2>
      <p className="lede">
        Workers locales en paralelo (CPU/RAM de esta máquina). Sin Drive ni
        red: extracción COMET + emparejado CASO/INFORME.
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

      {started ? (
        <MapBusy
          label={progress.label}
          done={progress.done}
          total={progress.total}
          elapsedMs={meta?.durationMs ?? elapsedMs}
          workerCount={progress.workerCount}
          running={running && !meta}
        />
      ) : null}

      {meta && !pending ? (
        <p className="status-msg" data-tone="ok">
          Tiempo total: {(meta.durationMs / 1000).toFixed(2)}s · {meta.pdfCount}{" "}
          PDF · {mappedOk} casos con datos
          {progress.workerCount
            ? ` · ${progress.workerCount} workers en paralelo`
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
