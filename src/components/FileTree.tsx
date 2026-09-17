import type { BoletinFileEntry } from "../../electron/ipc/channels";

function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(entry: BoletinFileEntry): string {
  if (entry.isDirectory) return "carpeta";
  if (entry.ext === ".pdf") return "pdf";
  return entry.ext.replace(".", "") || "archivo";
}

type FileTreeProps = {
  files: BoletinFileEntry[];
};

export function FileTree({ files }: FileTreeProps) {
  if (files.length === 0) {
    return <p className="status-msg">La carpeta está vacía.</p>;
  }

  return (
    <ul className="file-tree" aria-label="Contenido del boletín">
      {files.map((file) => (
        <li key={file.absolutePath}>
          <span className="file-kind">{kindLabel(file)}</span>
          <span title={file.absolutePath}>{file.name}</span>
          <span className="file-size">
            {file.isDirectory ? "—" : formatSize(file.size)}
          </span>
        </li>
      ))}
    </ul>
  );
}
