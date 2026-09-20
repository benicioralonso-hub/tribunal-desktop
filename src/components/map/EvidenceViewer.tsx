import { useEffect, useMemo, useState } from "react";
import type {
  AttachmentKind,
  MappedCase,
} from "../../shared/map/types";
import { getTribunalApi } from "../../bridge/api";

export type EvidenceTab = {
  id: string;
  label: string;
  pdfPath: string | null;
  included: boolean;
  kind: "informe" | "caso" | AttachmentKind;
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
    const informeIncluded =
      siblings.find((s) => s.informePdfPath)?.informeIncluded ??
      caseItem.informeIncluded ??
      true;
    tabs.push({
      id: "informe",
      label: "Ver Informe",
      pdfPath: informe,
      included: informeIncluded,
      kind: "informe",
    });
  }
  const casos = siblings.filter((s) => s.casoPdfPath);
  if (casos.length === 0 && caseItem.casoPdfPath) {
    tabs.push({
      id: `caso-${caseItem.id}`,
      label: "Ver Caso",
      pdfPath: caseItem.casoPdfPath,
      included: caseItem.included,
      kind: "caso",
    });
  } else {
    casos.forEach((c, i) => {
      tabs.push({
        id: `caso-${c.id}`,
        label: casos.length === 1 ? "Ver Caso" : `Ver Caso ${i + 1}`,
        pdfPath: c.casoPdfPath,
        included: c.included,
        kind: "caso",
      });
    });
  }

  const seen = new Set(
    tabs.map((t) => t.pdfPath).filter((p): p is string => Boolean(p)),
  );
  const attachments = caseItem.attachments ?? [];
  for (const att of attachments) {
    if (seen.has(att.path)) continue;
    seen.add(att.path);
    const label =
      att.kind === "descargo"
        ? `Descargo`
        : att.kind === "nota"
          ? `Nota`
          : att.name.replace(/\.pdf$/i, "") || "Adjunto";
    tabs.push({
      id: `att-${att.id}`,
      label,
      pdfPath: att.path,
      included: att.included,
      kind: att.kind,
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
    setActiveId((prev) => {
      if (prev && tabs.some((t) => t.id === prev)) return prev;
      return tabs[0]?.id ?? null;
    });
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
              data-included={tab.included}
              title={tab.included ? "Incluido en el borrador" : "Excluido del borrador"}
              onClick={() => setActiveId(tab.id)}
            >
              <span
                className="evidence-tab-dot"
                data-included={tab.included}
                aria-hidden
              />
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
