import type { MappedCase } from "../../shared/map/types";

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

  const title =
    caseItem.draft?.title ||
    (caseItem.homeClub && caseItem.awayClub
      ? `${caseItem.homeClub} c. ${caseItem.awayClub}`
      : caseItem.folderName);
  const fullText =
    caseItem.draft?.fullText ||
    "Aún no hay borrador generado para este caso.";

  return (
    <section className="draft-main glass-panel" aria-label="Borrador del fallo">
      <header className="draft-main-header">
        <h3>{title}</h3>
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
        <label htmlFor="draft-editor">Borrador del fallo</label>
        <textarea
          id="draft-editor"
          className="draft-editor"
          value={fullText}
          onChange={(e) => onDraftChange(e.target.value)}
          spellCheck
        />
      </div>
    </section>
  );
}
