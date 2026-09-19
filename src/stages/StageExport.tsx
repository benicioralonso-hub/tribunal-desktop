type Props = { onBack: () => void; caseCount?: number };

export function StageExport({ onBack, caseCount = 0 }: Props) {
  return (
    <section className="stage-select">
      <h2>Exportación DOCX</h2>
      <p className="lede">
        Montserrat Bold 500 · 12pt · justificado · títulos subrayados · cuerpo
        sin subrayar
        {caseCount > 0 ? ` · ${caseCount} caso(s) auditados listos` : ""}.
      </p>
      <button type="button" className="btn-secondary" onClick={onBack}>
        Volver
      </button>
    </section>
  );
}
