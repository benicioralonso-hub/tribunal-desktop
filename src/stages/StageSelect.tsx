import { useState, useTransition } from "react";
import { getTribunalApi } from "../bridge/api";
import type { BoletinFileEntry } from "../../electron/ipc/channels";
import { FileTree } from "../components/FileTree";

type StageSelectProps = {
  onContinue: (folderPath: string, files: BoletinFileEntry[]) => void;
};

export function StageSelect({ onContinue }: StageSelectProps) {
  const [pending, startTransition] = useTransition();
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [files, setFiles] = useState<BoletinFileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  function pickFolder() {
    setError(null);
    startTransition(async () => {
      try {
        const api = getTribunalApi();
        const result = await api.selectBoletinFolder();
        if (!result.ok) {
          if ("canceled" in result && result.canceled) return;
          setError("error" in result ? result.error : "Selección cancelada");
          return;
        }
        setFolderPath(result.folderPath);
        setFiles(result.files);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error nativo");
      }
    });
  }

  const pdfCount = files.filter((f) => f.ext === ".pdf").length;

  return (
    <section className="stage-select glass-panel" aria-labelledby="stage1-title">
      <h2 id="stage1-title">Selección nativa</h2>
      <p className="lede">
        Elegí la carpeta del boletín en tu disco (por defecto G:\ en Windows).
        Se lista con el sistema de archivos local — sin Google Drive.
      </p>

      <div className="cta-row">
        <button
          type="button"
          className="btn-primary"
          onClick={pickFolder}
          disabled={pending}
        >
          {pending ? "Abriendo…" : "Elegir carpeta del boletín"}
        </button>
        {folderPath ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onContinue(folderPath, files)}
          >
            Continuar al mapeo
          </button>
        ) : null}
      </div>

      {error ? <p className="status-msg">{error}</p> : null}

      {folderPath ? (
        <>
          <p className="folder-path">{folderPath}</p>
          <p className="status-msg" data-tone="ok">
            {files.length} ítems · {pdfCount} PDF
          </p>
          <FileTree files={files} />
        </>
      ) : null}
    </section>
  );
}
