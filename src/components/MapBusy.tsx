type MapBusyProps = {
  label: string;
  done: number;
  total: number;
  elapsedMs: number;
  workerCount?: number;
  running: boolean;
  /** Unidad en la meta (default PDF) */
  unitLabel?: string;
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

export function MapBusy({
  label,
  done,
  total,
  elapsedMs,
  workerCount,
  running,
  unitLabel = "PDF",
}: MapBusyProps) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div
      className="map-busy"
      data-running={running}
      role="status"
      aria-live="polite"
      aria-busy={running}
    >
      <div className="map-busy-top">
        <span className="map-spinner" aria-hidden="true" />
        <div className="map-busy-copy">
          <p className="map-busy-label">{label}</p>
          <p className="map-busy-meta">
            {total > 0 ? (
              <>
                {done} / {total} {unitLabel} · {pct}%
              </>
            ) : (
              "Preparando…"
            )}
            {workerCount ? ` · ${workerCount} workers` : null}
            {" · "}
            <span className="map-busy-clock">{formatElapsed(elapsedMs)}</span>
            {running ? " transcurridos" : " total"}
          </p>
        </div>
      </div>
      <div
        className="map-busy-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="map-busy-bar-fill"
          style={{ width: `${total > 0 ? pct : running ? 12 : 0}%` }}
          data-indeterminate={total === 0 && running}
        />
      </div>
    </div>
  );
}
