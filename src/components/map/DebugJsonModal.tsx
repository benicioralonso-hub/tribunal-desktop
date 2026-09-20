import type { MappedCase } from "../../shared/map/types";

type Props = {
  caseItem: MappedCase;
  onClose: () => void;
};

export function DebugJsonModal({ caseItem, onClose }: Props) {
  const json = JSON.stringify(caseItem, null, 2);

  return (
    <div
      className="debug-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="debug-modal glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debug-json-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="debug-modal-head">
          <h3 id="debug-json-title">Debug JSON</h3>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <pre className="debug-modal-pre">{json}</pre>
      </div>
    </div>
  );
}
