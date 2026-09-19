import { useEffect, useRef, useState, useTransition } from "react";
import { getTribunalApi } from "../bridge/api";
import { MapBusy } from "../components/MapBusy";
import type { MappedCase } from "../../shared/map/types";
import type {
  AuditedCase,
  AuditProgressEvent,
} from "../../shared/ai/audit-types";

type Props = {
  cases: MappedCase[];
  onBack: () => void;
  onContinue: (audited: AuditedCase[]) => void;
};

export function StageAudit({ cases, onBack, onContinue }: Props) {
  const [pending, startTransition] = useTransition();
  const [audited, setAudited] = useState<AuditedCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AuditProgressEvent>({
    done: 0,
    total: cases.length,
    label: "Listo para auditar",
  });
  const [meta, setMeta] = useState<{
    durationMs: number;
    correctedCount: number;
  } | null>(null);
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<number | null>(null);
  const t0Ref = useRef(0);

  useEffect(() => {
    const api = getTribunalApi();
    return api.onAuditProgress((ev) => setProgress(ev));
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

  function runAudit() {
    setError(null);
    setAudited([]);
    setMeta(null);
    setStarted(true);
    setProgress({
      done: 0,
      total: cases.length,
      label: `Auditando mapeo con Gemini (${cases.length} casos)…`,
    });
    startClock();
    startTransition(async () => {
      try {
        const result = await getTribunalApi().auditMappedCases(cases);
        stopClock();
        if (!result.ok) {
          setError(result.error);
          setProgress({
            done: 0,
            total: cases.length,
            label: "Auditoría interrumpida",
          });
          return;
        }
        setElapsedMs(result.durationMs);
        setAudited(result.cases);
        setMeta({
          durationMs: result.durationMs,
          correctedCount: result.correctedCount,
        });
        setProgress({
          done: result.cases.length,
          total: result.cases.length,
          label: `Auditoría lista en ${(result.durationMs / 1000).toFixed(1)}s`,
        });
      } catch (err) {
        stopClock();
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  useEffect(() => {
    if (!started && cases.length > 0) runAudit();
    // auto-start once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = (pending || !meta) && started && !error;
  const corrected = audited.filter((c) => c.correctionsApplied);

  return (
    <section className="stage-select stage-audit" aria-labelledby="stage3-title">
      <h2 id="stage3-title">Auditoría IA</h2>
      <p className="lede">
        Segunda instancia con Gemini sobre {cases.length} caso(s) mapeados: solo
        ortografía, tipeo y género — sin reescribir el fallo.
      </p>

      <div className="cta-row">
        <button
          type="button"
          className="btn-primary"
          onClick={runAudit}
          disabled={pending || cases.length === 0}
        >
          {pending ? "Auditando…" : started ? "Volver a auditar" : "Auditar mapeo"}
        </button>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Volver al mapeo
        </button>
        {audited.length > 0 ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onContinue(audited)}
          >
            Continuar a exportación
          </button>
        ) : null}
      </div>

      {started ? (
        <MapBusy
          label={progress.label}
          done={progress.done}
          total={progress.total}
          elapsedMs={meta?.durationMs ?? elapsedMs}
          running={Boolean(running && !meta)}
          unitLabel="casos"
        />
      ) : null}

      {meta && !pending ? (
        <p className="status-msg" data-tone="ok">
          Tiempo total: {(meta.durationMs / 1000).toFixed(2)}s ·{" "}
          {meta.correctedCount} corrección(es) · {audited.length} casos
        </p>
      ) : null}

      {error ? <p className="status-msg">{error}</p> : null}

      {corrected.length > 0 ? (
        <div className="map-table-wrap">
          <table className="map-table">
            <thead>
              <tr>
                <th>Partido / carpeta</th>
                <th>Infractor</th>
                <th>Rol</th>
                <th>Club</th>
                <th>Notas de auditoría</th>
              </tr>
            </thead>
            <tbody>
              {corrected.map((c) => (
                <tr key={c.id}>
                  <td title={c.folderPath}>{c.folderName}</td>
                  <td>{c.person ?? "—"}</td>
                  <td>{c.role ?? "—"}</td>
                  <td>{c.club ?? "—"}</td>
                  <td>{c.auditNotes.join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : audited.length > 0 && !pending ? (
        <p className="status-msg" data-tone="ok">
          Sin correcciones: el mapeo pasó la auditoría.
        </p>
      ) : null}
    </section>
  );
}
