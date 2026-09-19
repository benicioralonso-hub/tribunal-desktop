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
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<AuditProgressEvent>({
    done: 0,
    total: cases.length,
    label: "Listo para auditar",
  });
  const [meta, setMeta] = useState<{
    durationMs: number;
    correctedCount: number;
    mode: string;
  } | null>(null);
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<number | null>(null);
  const t0Ref = useRef(0);
  const autoStarted = useRef(false);

  useEffect(() => {
    const api = getTribunalApi();
    return api.onAuditProgress((ev) => setProgress(ev));
  }, []);

  useEffect(() => {
    void getTribunalApi()
      .getAuditStatus()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
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

  function runAudit(opts?: { skipAi?: boolean }) {
    setError(null);
    setAudited([]);
    setMeta(null);
    setStarted(true);
    const skipAi = Boolean(opts?.skipAi);
    setProgress({
      done: 0,
      total: cases.length,
      label: skipAi
        ? `Auditoría local (${cases.length} casos)…`
        : `Auditando mapeo con Gemini (${cases.length} casos)…`,
    });
    startClock();
    startTransition(async () => {
      try {
        const result = await getTribunalApi().auditMappedCases(cases, {
          skipAi,
        });
        stopClock();
        if (!result.ok) {
          setError(result.error);
          setProgress({
            done: 0,
            total: cases.length,
            label: result.cancelled
              ? "Auditoría cancelada"
              : "Auditoría interrumpida",
            cancelled: result.cancelled,
          });
          return;
        }
        setElapsedMs(result.durationMs);
        setAudited(result.cases);
        setMeta({
          durationMs: result.durationMs,
          correctedCount: result.correctedCount,
          mode: result.mode,
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
    if (autoStarted.current || cases.length === 0 || configured === null) return;
    autoStarted.current = true;
    // Con o sin key: arranca (sin key → heurística local automática en main)
    runAudit({ skipAi: !configured });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  async function onCancel() {
    await getTribunalApi().cancelAudit();
  }

  const running = pending && started && !meta;
  const corrected = audited.filter((c) => c.correctionsApplied);

  return (
    <section className="stage-select stage-audit" aria-labelledby="stage3-title">
      <h2 id="stage3-title">Auditoría IA</h2>
      <p className="lede">
        Segunda instancia con Gemini sobre {cases.length} caso(s) mapeados: solo
        ortografía, tipeo y género — sin reescribir el fallo.
        {configured === false ? (
          <>
            {" "}
            <strong>Sin GEMINI_API_KEY</strong> — se usa heurística local (o
            configurá `.env`).
          </>
        ) : null}
        {configured === true ? <> Gemini configurado.</> : null}
      </p>

      <div className="cta-row">
        <button
          type="button"
          className="btn-primary"
          onClick={() => runAudit({ skipAi: false })}
          disabled={pending || cases.length === 0}
        >
          {pending ? "Auditando…" : started ? "Volver a auditar" : "Auditar mapeo"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => runAudit({ skipAi: true })}
          disabled={pending || cases.length === 0}
        >
          Continuar sin IA
        </button>
        {running ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
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
          running={Boolean(running)}
          unitLabel="casos"
        />
      ) : null}

      {meta && !pending ? (
        <p className="status-msg" data-tone="ok">
          Tiempo total: {(meta.durationMs / 1000).toFixed(2)}s ·{" "}
          {meta.correctedCount} corrección(es) · {audited.length} casos · modo{" "}
          {meta.mode}
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
