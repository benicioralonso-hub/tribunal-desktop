import { useState, useTransition } from "react";
import { getTribunalApi } from "../bridge/api";
import { MapBusy } from "../components/MapBusy";
import type { AuditedCase } from "../../shared/ai/audit-types";

type Props = {
  onBack: () => void;
  cases: AuditedCase[];
};

export function StageExport({ onBack, cases }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);

  function exportDocx() {
    setError(null);
    setFilePath(null);
    setRunning(true);
    setElapsedMs(0);
    const t0 = performance.now();
    startTransition(async () => {
      try {
        const result = await getTribunalApi().exportBoletinDocx(cases);
        setElapsedMs(Math.round(performance.now() - t0));
        setRunning(false);
        if (!result.ok) {
          if ("canceled" in result && result.canceled) {
            setError(null);
            return;
          }
          setError("error" in result ? result.error : "Exportación fallida");
          return;
        }
        setFilePath(result.filePath);
        setElapsedMs(result.durationMs);
      } catch (err) {
        setRunning(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <section
      className="stage-select stage-export glass-panel"
      aria-labelledby="stage4-title"
    >
      <h2 id="stage4-title">Exportación DOCX</h2>
      <p className="lede">
        Montserrat (Medium 500 / Bold) · 12pt · justificado · títulos subrayados
        · cuerpo sin subrayar
        {cases.length > 0 ? ` · ${cases.length} caso(s) listos` : ""}.
      </p>

      <div className="cta-row">
        <button
          type="button"
          className="btn-primary"
          onClick={exportDocx}
          disabled={pending || cases.length === 0}
        >
          {pending ? "Exportando…" : "Exportar DOCX"}
        </button>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Volver
        </button>
      </div>

      {running || pending ? (
        <MapBusy
          label="Generando DOCX con Montserrat…"
          done={running ? 0 : 1}
          total={1}
          elapsedMs={elapsedMs}
          running={running || pending}
          unitLabel="doc"
        />
      ) : null}

      {filePath ? (
        <p className="status-msg" data-tone="ok">
          Exportado en {(elapsedMs / 1000).toFixed(2)}s → {filePath}
        </p>
      ) : null}

      {error ? <p className="status-msg">{error}</p> : null}
    </section>
  );
}
