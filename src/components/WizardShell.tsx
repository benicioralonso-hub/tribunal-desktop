import type { ReactNode } from "react";

const STEPS = [
  { id: 1, label: "Selección" },
  { id: 2, label: "Mapeo" },
  { id: 3, label: "Auditoría IA" },
  { id: 4, label: "Exportación" },
] as const;

type WizardShellProps = {
  stage: 1 | 2 | 3 | 4;
  children: ReactNode;
};

export function WizardShell({ stage, children }: WizardShellProps) {
  return (
    <div className="wizard-shell" data-stage={stage}>
      <header className="wizard-brand">
        <h1>Tribunal Disciplinario</h1>
        <p>
          Automatizá, mapeá y redactá borradores de fallo en tu disco local. Sin
          Drive. Sin nube de expedientes.
        </p>
        <nav className="wizard-steps" aria-label="Estadíos">
          {STEPS.map((step) => (
            <span
              key={step.id}
              className="wizard-step"
              data-active={step.id === stage}
              data-done={step.id < stage}
            >
              <span className="wizard-step-index">{step.id}</span>
              {step.label}
            </span>
          ))}
        </nav>
      </header>
      <main className="wizard-main">{children}</main>
    </div>
  );
}
