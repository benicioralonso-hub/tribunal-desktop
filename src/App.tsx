import { useState } from "react";
import { WizardShell } from "./components/WizardShell";
import { StageSelect } from "./stages/StageSelect";
import { StageMap } from "./stages/StageMap";
import { StageAudit } from "./stages/StageAudit";
import { StageExport } from "./stages/StageExport";
import type { BoletinFileEntry } from "../electron/ipc/channels";
import type { MappedCase } from "../shared/map/types";
import type { AuditedCase } from "../shared/ai/audit-types";

type Stage = 1 | 2 | 3 | 4;

export default function App() {
  const [stage, setStage] = useState<Stage>(1);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [, setFiles] = useState<BoletinFileEntry[]>([]);
  const [mappedCases, setMappedCases] = useState<MappedCase[]>([]);
  const [auditedCases, setAuditedCases] = useState<AuditedCase[]>([]);

  return (
    <WizardShell stage={stage}>
      {stage === 1 ? (
        <StageSelect
          onContinue={(path, listed) => {
            setFolderPath(path);
            setFiles(listed);
            setMappedCases([]);
            setAuditedCases([]);
            setStage(2);
          }}
        />
      ) : null}
      {stage === 2 && folderPath ? (
        <StageMap
          folderPath={folderPath}
          onBack={() => setStage(1)}
          onContinue={(cases) => {
            setMappedCases(cases);
            setAuditedCases([]);
            setStage(3);
          }}
        />
      ) : null}
      {stage === 3 ? (
        <StageAudit
          cases={mappedCases}
          onBack={() => setStage(2)}
          onContinue={(audited) => {
            setAuditedCases(audited);
            setStage(4);
          }}
        />
      ) : null}
      {stage === 4 ? (
        <StageExport
          cases={
            auditedCases.length > 0
              ? auditedCases
              : mappedCases.map((c) => ({
                  ...c,
                  auditNotes: [],
                  correctionsApplied: false,
                }))
          }
          onBack={() => setStage(3)}
        />
      ) : null}
    </WizardShell>
  );
}
