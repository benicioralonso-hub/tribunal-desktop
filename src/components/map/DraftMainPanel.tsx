import type { MappedCase } from "../../shared/map/types";
import type { FalloDraft, SanctionKind } from "../../../shared/fallo/types";
import { MANUAL_TIPIFY_ARTICLES } from "../../../shared/fallo/tipify-tipo-evento";
import {
  buildManualFalloDraft,
  defaultArticleForKind,
  isTextOnlyKind,
  kindAllowsArticlePicker,
  kindNeedsPartidos,
} from "../../../shared/fallo/manual-fallo";
import {
  MANUAL_TEXT_TYPE_OPTIONS,
  SANCTION_KIND_LABEL,
  splitFalloFullText,
} from "../../../shared/fallo/render-fallo";
import { useEffect, useState } from "react";

type Props = {
  caseItem: MappedCase | null;
  onDraftChange: (fullText: string) => void;
  onTipifyApply: (draft: FalloDraft) => void;
};

const DEFAULT_KIND: SanctionKind = "suspension_partidos";

export function DraftMainPanel({
  caseItem,
  onDraftChange,
  onTipifyApply,
}: Props) {
  const [kind, setKind] = useState<SanctionKind>(DEFAULT_KIND);
  const [article, setArticle] = useState(defaultArticleForKind(DEFAULT_KIND));
  const [partidos, setPartidos] = useState(1);
  const [customText, setCustomText] = useState("");

  useEffect(() => {
    const fromDraft = caseItem?.draft?.items?.[0]?.kind;
    const nextKind =
      fromDraft && fromDraft !== "otra"
        ? fromDraft
        : caseItem?.draft?.status === "sin_tipificar"
          ? DEFAULT_KIND
          : fromDraft || DEFAULT_KIND;
    setKind(nextKind);
    setArticle(
      caseItem?.draft?.items?.[0]?.article ||
        defaultArticleForKind(nextKind),
    );
    setPartidos(caseItem?.draft?.items?.[0]?.partidos || 1);
    setCustomText(
      nextKind === "otra" ? caseItem?.draft?.items?.[0]?.bodyText || "" : "",
    );
  }, [caseItem?.id, caseItem?.draft?.status]);

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
  const showArticle = kindAllowsArticlePicker(kind);
  const showPartidos = kindNeedsPartidos(kind);
  const showCustomText = kind === "otra";
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

  function onKindChange(next: SanctionKind) {
    setKind(next);
    setArticle(defaultArticleForKind(next));
    if (next === "doble_amonestacion") setPartidos(1);
    if (!kindNeedsPartidos(next)) setPartidos(1);
    if (next !== "otra") setCustomText("");
  }

  function applyManualTipify() {
    const resolvedArticle = showArticle
      ? article
      : defaultArticleForKind(kind) || article;
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
          partidos: showPartidos
            ? kind === "doble_amonestacion"
              ? 1
              : partidos
            : undefined,
          article: isTextOnlyKind(kind) ? undefined : resolvedArticle,
          opponentClub:
            kind === "medida_autorizada"
              ? caseItem!.awayClub || caseItem!.homeClub || undefined
              : undefined,
          customText: showCustomText ? customText : undefined,
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
        {caseItem.draft?.items?.[0]?.kind ? (
          <p className="draft-tipo-texto">
            Tipo de texto actual:{" "}
            {SANCTION_KIND_LABEL[caseItem.draft.items[0].kind] ||
              caseItem.draft.items[0].kind}
          </p>
        ) : null}
      </header>

      <div
        className={`tipify-panel${needsTipify ? " tipify-panel-warn" : ""}`}
        role="region"
        aria-label="Tipo de texto y tipificación"
      >
        {needsTipify ? (
          <p className="tipify-badge">⚠️ Requiere Tipificación Manual</p>
        ) : (
          <p className="tipify-label">Tipo de texto</p>
        )}
        <div className="tipify-controls">
          <label>
            Tipo de texto
            <select
              value={kind}
              onChange={(e) => onKindChange(e.target.value as SanctionKind)}
            >
              {MANUAL_TEXT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.kind} value={opt.kind}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {showArticle ? (
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
          ) : null}
          {showPartidos ? (
            <label>
              Fechas de suspensión
              <input
                type="number"
                min={1}
                max={99}
                value={kind === "doble_amonestacion" ? 1 : partidos}
                disabled={kind === "doble_amonestacion"}
                onChange={(e) =>
                  setPartidos(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </label>
          ) : null}
          {showCustomText ? (
            <label className="tipify-custom-text">
              Texto libre
              <textarea
                value={customText}
                rows={3}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Redacción libre de la resolución…"
              />
            </label>
          ) : null}
          <button
            type="button"
            className="btn-primary tipify-apply"
            onClick={applyManualTipify}
          >
            Aplicar tipificación
          </button>
        </div>
      </div>

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
