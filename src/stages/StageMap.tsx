import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getTribunalApi } from "../bridge/api";
import { MapBusy } from "../components/MapBusy";
import { DraftMainPanel } from "../components/map/DraftMainPanel";
import { MatchSidebar } from "../components/map/MatchSidebar";
import { EvidenceViewer } from "../components/map/EvidenceViewer";
import { DebugJsonModal } from "../components/map/DebugJsonModal";
import type { MappedCase, MapProgressEvent } from "../../shared/map/types";
import type { FalloDraft } from "../../shared/fallo/types";

type Props = {
  folderPath: string;
  onBack: () => void;
  onContinue: (cases: MappedCase[]) => void;
};

export function StageMap({ folderPath, onBack, onContinue }: Props) {
  const [pending, startTransition] = useTransition();
  const [cases, setCases] = useState<MappedCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [debugCase, setDebugCase] = useState<MappedCase | null>(null);
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
    setSelectedId(null);
    setDebugCase(null);
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
        setSelectedId(result.cases[0]?.id ?? null);
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

  const selected = cases.find((c) => c.id === selectedId) ?? null;
  const siblings = useMemo(() => {
    if (!selected) return [];
    return cases.filter((c) => c.folderPath === selected.folderPath);
  }, [cases, selected]);
  const mappedOk = cases.filter((c) => c.person || c.homeClub).length;
  const warnCount = cases.filter((c) => c.warning).length;
  const running = pending || progress.phase !== "done";

  function onDraftChange(fullText: string) {
    if (!selectedId) return;
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== selectedId) return c;
        const nl = fullText.indexOf("\n");
        const header =
          nl >= 0 ? fullText.slice(0, nl).trim() : fullText.trim();
        const body = nl >= 0 ? fullText.slice(nl + 1).trim() : "";
        return {
          ...c,
          draft: {
            title: header,
            header,
            body,
            fullText,
            items: c.draft?.items ?? [],
            confidence: c.draft?.confidence ?? c.confidence,
            status: "modified",
            rationale: c.draft?.rationale,
            redactorModel: c.draft?.redactorModel ?? "manual",
            updatedAt: new Date().toISOString(),
          },
        };
      }),
    );
  }

  function onTipifyApply(draft: FalloDraft) {
    if (!selectedId) return;
    setCases((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, draft } : c)),
    );
  }

  function onToggleCaso(caseId: string, included: boolean) {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, included } : c)),
    );
  }

  function onToggleInforme(folderPath: string, included: boolean) {
    setCases((prev) =>
      prev.map((c) =>
        c.folderPath === folderPath ? { ...c, informeIncluded: included } : c,
      ),
    );
  }

  function onToggleAttachment(
    folderPath: string,
    attachmentId: string,
    included: boolean,
  ) {
    setCases((prev) =>
      prev.map((c) => {
        if (c.folderPath !== folderPath) return c;
        return {
          ...c,
          attachments: c.attachments.map((a) =>
            a.id === attachmentId ? { ...a, included } : a,
          ),
        };
      }),
    );
  }

  function handleContinue() {
    const forAudit = cases
      .filter((c) => c.included)
      .map((c) =>
        c.informeIncluded ? c : { ...c, informePdfPath: null },
      );
    onContinue(forAudit);
  }

  const includedCount = cases.filter((c) => c.included).length;

  return (
    <section className="stage-select stage-map" aria-labelledby="stage2-title">
      <div className="stage-map-head">
        <h2 id="stage2-title">Mapeo y borradores</h2>
        <p className="lede">
          Extracción local en paralelo, tipificación y evidencia PDF en split
          view. Revisá, editá y continuá a auditoría.
        </p>
        <p className="folder-path">{folderPath}</p>

        <div className="cta-row">
          <button
            type="button"
            className="btn-primary"
            onClick={runMap}
            disabled={pending}
          >
            {pending
              ? "Mapeando…"
              : started
                ? "Volver a mapear"
                : "Iniciar mapeo"}
          </button>
          <button type="button" className="btn-secondary" onClick={onBack}>
            Volver
          </button>
          {cases.length > 0 ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleContinue}
              disabled={includedCount === 0}
              title={
                includedCount === 0
                  ? "Incluí al menos un caso para continuar"
                  : undefined
              }
            >
              Continuar a auditoría
              {includedCount < cases.length
                ? ` (${includedCount}/${cases.length})`
                : ""}
            </button>
          ) : null}
        </div>
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
          {(meta.durationMs / 1000).toFixed(2)}s · {meta.pdfCount} PDF ·{" "}
          {mappedOk} con datos
          {warnCount > 0 ? ` · ${warnCount} alerta(s)` : null}
          {progress.workerCount
            ? ` · ${progress.workerCount} workers`
            : null}
        </p>
      ) : null}

      {error ? <p className="status-msg">{error}</p> : null}

      {cases.length > 0 ? (
        <div className="stage-map-review stage-map-split">
          <MatchSidebar
            cases={cases}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDebug={setDebugCase}
            onToggleCaso={onToggleCaso}
            onToggleInforme={onToggleInforme}
            onToggleAttachment={onToggleAttachment}
          />
          <div className="stage-map-workspace">
            <DraftMainPanel
              caseItem={selected}
              onDraftChange={onDraftChange}
              onTipifyApply={onTipifyApply}
            />
            <EvidenceViewer caseItem={selected} siblings={siblings} />
          </div>
        </div>
      ) : null}

      {debugCase ? (
        <DebugJsonModal
          caseItem={debugCase}
          onClose={() => setDebugCase(null)}
        />
      ) : null}
    </section>
  );
}
