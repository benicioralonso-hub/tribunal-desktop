import type { MappedCase } from "../../shared/map/types";
import { splitFalloFullText } from "../../../shared/fallo/render-fallo";

type Props = {
  caseItem: MappedCase | null;
  onDraftChange: (fullText: string) => void;
};

export function DraftMainPanel({ caseItem, onDraftChange }: Props) {
  if (!caseItem) {
    return (
      <section className="draft-main glass-panel" aria-label="Borrador del fallo">
        <div className="draft-main-empty">
          <p>Seleccioná un partido en la barra lateral para revisar el borrador.</p>
        </div>
      </section>
    );
  }

  const header =
    caseItem.draft?.header ||
    caseItem.draft?.title ||
    (caseItem.homeClub && caseItem.awayClub
      ? `${caseItem.homeClub} c. ${caseItem.awayClub}`
      : caseItem.folderName);
  const body =
    caseItem.draft?.body ||
    (caseItem.draft?.fullText
      ? splitFalloFullText(caseItem.draft.fullText).body
      : "");
  const fullText = caseItem.draft?.fullText || `${header}\n${body}`.trim();

  return (
    <section className="draft-main glass-panel" aria-label="Borrador del fallo">
      <header className="draft-main-header">
        <p className="draft-label">Título del fallo</p>
        <h3 className="draft-title">{header}</h3>
        {caseItem.expediente ? (
          <p className="draft-exp">Expediente Nº {caseItem.expediente}</p>
        ) : null}
        <div className="draft-meta-row">
          {caseItem.person ? <span>Infractor: {caseItem.person}</span> : null}
          {caseItem.role ? <span>Rol: {caseItem.role}</span> : null}
          {caseItem.matchDate ? <span>Fecha: {caseItem.matchDate}</span> : null}
          {caseItem.competition ? (
            <span>{caseItem.competition}</span>
          ) : null}
        </div>
      </header>

      {caseItem.warning ? (
        <p className="draft-alert" role="alert">
          ⚠️ {caseItem.warning}
        </p>
      ) : null}

      {caseItem.error ? (
        <p className="draft-alert" role="alert">
          Error de extracción: {caseItem.error}
        </p>
      ) : null}

      <div className="draft-editor-wrap">
        <label htmlFor="draft-editor">Cuerpo del fallo</label>
        <textarea
          id="draft-editor"
          className="draft-editor"
          value={fullText}
          onChange={(e) => onDraftChange(e.target.value)}
          spellCheck
        />
        <p className="draft-hint">
          Formato manual AFA: título (primera línea) + resoluciones. Editable
          antes de auditar.
        </p>
      </div>
    </section>
  );
}
