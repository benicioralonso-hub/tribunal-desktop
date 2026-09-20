import { useEffect, useMemo, useState } from "react";
import type { MappedCase } from "../../shared/map/types";
import { getTribunalApi } from "../../bridge/api";

export type EvidenceTab = {
  id: string;
  label: string;
  pdfPath: string | null;
};

export function buildEvidenceTabs(
  caseItem: MappedCase,
  siblings: MappedCase[],
): EvidenceTab[] {
  const tabs: EvidenceTab[] = [];
  const informe =
    caseItem.informePdfPath ||
    siblings.find((s) => s.informePdfPath)?.informePdfPath ||
    null;
  if (informe) {
    tabs.push({ id: "informe", label: "Ver Informe", pdfPath: informe });
  }
  const casos = siblings.filter((s) => s.casoPdfPath);
  if (casos.length === 0 && caseItem.casoPdfPath) {
    tabs.push({
      id: `caso-${caseItem.id}`,
      label: "Ver Caso",
      pdfPath: caseItem.casoPdfPath,
    });
  } else {
    casos.forEach((c, i) => {
      tabs.push({
        id: `caso-${c.id}`,
        label: casos.length === 1 ? "Ver Caso" : `Ver Caso ${i + 1}`,
        pdfPath: c.casoPdfPath,
      });
    });
  }
  return tabs;
}

type Props = {
  caseItem: MappedCase | null;
  siblings: MappedCase[];
};

export function EvidenceViewer({ caseItem, siblings }: Props) {
  const tabs = useMemo(
    () => (caseItem ? buildEvidenceTabs(caseItem, siblings) : []),
    [caseItem, siblings],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActiveId(tabs[0]?.id ?? null);
  }, [caseItem?.id, tabs]);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0] ?? null;

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    async function load() {
      setError(null);
      setBlobUrl(null);
      if (!active?.pdfPath) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await getTribunalApi().readLocalPdf(active.pdfPath);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setLoading(false);
          return;
        }
        const binary = atob(res.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: res.mimeType });
        const url = URL.createObjectURL(blob);
        revoked = url;
        setBlobUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [active?.pdfPath, active?.id]);

  if (!caseItem) {
    return (
      <aside className="evidence-panel glass-panel" aria-label="Evidencia PDF">
        <div className="evidence-empty">
          <p>Seleccioná un caso para ver Informe / Caso PDF.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="evidence-panel glass-panel" aria-label="Evidencia PDF">
      <div className="evidence-tabs" role="tablist" aria-label="Documentos">
        {tabs.length === 0 ? (
          <span className="evidence-tab-empty">Sin PDFs asociados</span>
        ) : (
          tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="evidence-tab"
              aria-selected={tab.id === active?.id}
              data-active={tab.id === active?.id}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.label}
            </button>
          ))
        )}
      </div>
      <div className="evidence-body">
        {loading ? (
          <p className="evidence-status">Cargando PDF…</p>
        ) : error ? (
          <p className="evidence-status" role="alert">
            {error}
          </p>
        ) : blobUrl ? (
          <iframe
            title={active?.label || "PDF"}
            className="evidence-iframe"
            src={blobUrl}
          />
        ) : (
          <p className="evidence-status">No hay PDF para mostrar.</p>
        )}
      </div>
    </aside>
  );
}
