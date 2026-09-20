import type { MappedCase } from "../../shared/map/types";
import type { FalloDraft, SanctionKind } from "../../../shared/fallo/types";
import { MANUAL_TIPIFY_ARTICLES } from "../../../shared/fallo/tipify-tipo-evento";
import { buildManualFalloDraft } from "../../../shared/fallo/manual-fallo";
import { splitFalloFullText } from "../../../shared/fallo/render-fallo";
import { useState } from "react";

type Props = {
  caseItem: MappedCase | null;
  onDraftChange: (fullText: string) => void;
  onTipifyApply: (draft: FalloDraft) => void;
};

function inferKindFromArticle(article: string): SanctionKind {
  if (/doble amonestaci|regla\s*12/i.test(article)) return "doble_amonestacion";
  if (/13\s*1\.\s*c\)|12\s*3\./i.test(article)) return "suspension_con_multa_ve";
  return "suspension_partidos";
}

export function DraftMainPanel({
  caseItem,
  onDraftChange,
  onTipifyApply,
}: Props) {
  const [article, setArticle] = useState(MANUAL_TIPIFY_ARTICLES[2]!);
  const [partidos, setPartidos] = useState(1);

  if (!caseItem) {
    return (
      <section className="draft-main glass-panel" aria-label="Borrador del fallo">
        <div className="draft-main-empty">
          <p>Seleccioná un partido en la barra lateral para revisar el borrador.</p>
        </div>
      </section>
    );
  }

  const needsTipify = caseItem.draft?.status === "sin_tipificar";
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

  function applyManualTipify() {
    const kind = inferKindFromArticle(article);
    const draft = buildManualFalloDraft({
      homeClub: caseItem!.homeClub || "",
      awayClub: caseItem!.awayClub || "",
      expedienteNumber: caseItem!.expediente || undefined,
      matchDate: caseItem!.matchDate || undefined,
      category: caseItem!.competition || undefined,
      matchFolder: caseItem!.folderName,
      resolutions: [
        {
          kind,
          personName: caseItem!.person || "",
          club: caseItem!.club || caseItem!.homeClub || "",
          role: caseItem!.role || "jugador",
          partidos,
          article,
          caseId: caseItem!.casoPdfPath || caseItem!.id,
        },
      ],
    });
    onTipifyApply({ ...draft, status: "modified" });
  }

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
        {caseItem.tipoEvento ? (
          <p className="draft-tipo-evento">
            Tipo de evento: {caseItem.tipoEvento}
          </p>
        ) : null}
      </header>

      {needsTipify ? (
        <div className="tipify-panel" role="region" aria-label="Tipificación manual">
          <p className="tipify-badge">⚠️ Requiere Tipificación Manual</p>
          <div className="tipify-controls">
            <label>
              Artículo
              <select
                value={article}
                onChange={(e) => setArticle(e.target.value)}
              >
                {MANUAL_TIPIFY_ARTICLES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fechas de suspensión
              <input
                type="number"
                min={1}
                max={99}
                value={partidos}
                onChange={(e) =>
                  setPartidos(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </label>
            <button
              type="button"
              className="btn-primary tipify-apply"
              onClick={applyManualTipify}
            >
              Aplicar tipificación
            </button>
          </div>
        </div>
      ) : null}

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
