type Props = {
  caseCount?: number;
  onBack: () => void;
  onContinue?: () => void;
};

export function StageAudit({ caseCount = 0, onBack, onContinue }: Props) {
  return (
    <section className="stage-select">
      <h2>Auditoría IA</h2>
      <p className="lede">
        Segunda instancia con Gemini sobre {caseCount} caso(s) mapeados: solo
        ortografía, tipeo y género — sin reescribir el fallo.
      </p>
      <div className="cta-row">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Volver al mapeo
        </button>
        {onContinue ? (
          <button type="button" className="btn-primary" onClick={onContinue}>
            Continuar a exportación
          </button>
        ) : null}
      </div>
    </section>
  );
}
