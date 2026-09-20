import type { MappedAttachment, MappedCase } from "../../shared/map/types";

export type ExpedienteDocRow = {
  id: string;
  label: string;
  kindLabel: string;
  included: boolean;
  optional: boolean;
  onToggle: (included: boolean) => void;
};

type Props = {
  rows: ExpedienteDocRow[];
};

function DocToggle({
  id,
  included,
  onToggle,
  label,
}: {
  id: string;
  included: boolean;
  onToggle: (included: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={included}
      aria-label={label}
      className="doc-toggle"
      data-on={included}
      onClick={() => onToggle(!included)}
    >
      <span className="doc-toggle-thumb" aria-hidden />
    </button>
  );
}

export function ExpedienteDocsList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="expediente-docs" aria-label="Documentos del expediente">
        <h4 className="expediente-docs-title">Documentos del Expediente</h4>
        <p className="expediente-docs-empty">Sin archivos en esta carpeta.</p>
      </div>
    );
  }

  const principales = rows.filter((r) => !r.optional);
  const opcionales = rows.filter((r) => r.optional);

  return (
    <div className="expediente-docs" aria-label="Documentos del expediente">
      <h4 className="expediente-docs-title">Documentos del Expediente</h4>

      {principales.length > 0 ? (
        <ul className="expediente-docs-list" aria-label="Documentos principales">
          {principales.map((row) => (
            <li key={row.id} className="expediente-doc-row" data-included={row.included}>
              <div className="expediente-doc-meta">
                <span className="expediente-doc-kind">{row.kindLabel}</span>
                <span className="expediente-doc-name" title={row.label}>
                  {row.label}
                </span>
              </div>
              <DocToggle
                id={`toggle-${row.id}`}
                included={row.included}
                onToggle={row.onToggle}
                label={`${row.included ? "Excluir" : "Incluir"} ${row.label}`}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {opcionales.length > 0 ? (
        <>
          <p className="expediente-docs-sub">Opcionales</p>
          <ul className="expediente-docs-list" aria-label="Documentos opcionales">
            {opcionales.map((row) => (
              <li
                key={row.id}
                className="expediente-doc-row"
                data-included={row.included}
                data-optional="true"
              >
                <div className="expediente-doc-meta">
                  <span className="expediente-doc-kind">{row.kindLabel}</span>
                  <span className="expediente-doc-name" title={row.label}>
                    {row.label}
                  </span>
                </div>
                <DocToggle
                  id={`toggle-${row.id}`}
                  included={row.included}
                  onToggle={row.onToggle}
                  label={`${row.included ? "Excluir" : "Incluir"} ${row.label}`}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function buildExpedienteRows(opts: {
  siblings: MappedCase[];
  attachments: MappedAttachment[];
  onToggleCaso: (caseId: string, included: boolean) => void;
  onToggleInforme: (included: boolean) => void;
  onToggleAttachment: (attachmentId: string, included: boolean) => void;
}): ExpedienteDocRow[] {
  const { siblings, attachments, onToggleCaso, onToggleInforme, onToggleAttachment } =
    opts;
  const rows: ExpedienteDocRow[] = [];

  const informePath =
    siblings.find((s) => s.informePdfPath)?.informePdfPath ?? null;
  if (informePath) {
    const name = informePath.split(/[/\\]/).pop() || "INFORME.pdf";
    const informeIncluded =
      siblings.find((s) => s.informePdfPath)?.informeIncluded ?? true;
    rows.push({
      id: "informe",
      label: name,
      kindLabel: "Informe",
      included: informeIncluded,
      optional: false,
      onToggle: onToggleInforme,
    });
  }

  const casos = siblings.filter((s) => s.casoPdfPath);
  casos.forEach((c, i) => {
    const name = c.casoPdfPath!.split(/[/\\]/).pop() || "CASO.pdf";
    const kindLabel =
      casos.length === 1
        ? "Caso"
        : `Caso ${i + 1}${c.person ? ` · ${c.person}` : ""}`;
    rows.push({
      id: `caso-${c.id}`,
      label: name,
      kindLabel,
      included: c.included,
      optional: false,
      onToggle: (included) => onToggleCaso(c.id, included),
    });
  });

  for (const att of attachments) {
    const kindLabel =
      att.kind === "descargo"
        ? "Descargo"
        : att.kind === "nota"
          ? "Nota"
          : "Otro";
    rows.push({
      id: `att-${att.id}`,
      label: att.name,
      kindLabel,
      included: att.included,
      optional: true,
      onToggle: (included) => onToggleAttachment(att.id, included),
    });
  }

  return rows;
}
