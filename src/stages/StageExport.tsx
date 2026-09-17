type Props = { onBack: () => void };

export function StageExport({ onBack }: Props) {
  return (
    <section className="stage-select">
      <h2>Exportación DOCX</h2>
      <p className="lede">
        Montserrat Bold 500 · 12pt · justificado · títulos subrayados · cuerpo
        sin subrayar.
      </p>
      <button type="button" className="btn-secondary" onClick={onBack}>
        Volver
      </button>
    </section>
  );
}
