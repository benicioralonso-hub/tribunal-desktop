/**
 * Limpieza / normalización de campos COMET — subconjunto autocontenido
 * de tribunal-app `fallo-sanitize` + `match-parse` (sin Drive/D1).
 */

const JUNK_FIELD_RE =
  /impreso\s+por|hora\s*:|decisi[oó]n\s+de\s+caso|n[uú]m\.?\s*:|competici[oó]n\s*:|infractor\s*:|entrenador\s+expulsado|tipo\s+de\s+infractor|descripci[oó]n\s+de|oficiales\s+de\s+partido|alineaciones|pdf|\bart\b.*\bhms\b|\bcomet\b|asociaci[oó]n\s+del\s+f[uú]tbol\s+argentino|p[aá]gina\s*:\s*\d/i;

/** Cabecera de página COMET (no es club ni persona). */
export function isCometPageHeader(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  if (/^comet\b/i.test(v)) return true;
  if (/asociaci[oó]n\s+del\s+f[uú]tbol\s+argentino/i.test(v)) return true;
  if (/impreso\s+por/i.test(v)) return true;
  if (/p[aá]gina\s*:\s*\d/i.test(v)) return true;
  return false;
}

const STOP_LABELS =
  "Club|Competici[oó]n|Equipo|Local|Visitante|Fecha|Hora|Impreso|Tipo|Descripci[oó]n|Motivo|N[uú]m|N[uú]mero|Decisi[oó]n|Partido|Categor[ií]a|Divisi[oó]n|Infractor|Entrenador|Jugador|Oficial";

const PERSON_ACCENTS: Record<string, string> = {
  martin: "Martín",
  jose: "José",
  maria: "María",
  andres: "Andrés",
  nicolas: "Nicolás",
  agustin: "Agustín",
  ramon: "Ramón",
  raul: "Raúl",
  hector: "Héctor",
  cesar: "César",
  oscar: "Óscar",
};

const CLUB_ACCENTS: Record<string, string> = {
  lanus: "Lanús",
  huracan: "Huracán",
  colon: "Colón",
  union: "Unión",
  atletico: "Atlético",
  "velez": "Vélez",
};

function restoreToken(
  token: string,
  dict: Record<string, string>,
): string {
  const key = token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const hit = dict[key];
  if (!hit) return token;
  // Preserve trailing punctuation
  const punct = token.match(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]+$/)?.[0] ?? "";
  return hit + punct;
}

export function restorePersonAccents(raw: string): string {
  return String(raw || "")
    .split(/\s+/)
    .map((t) => restoreToken(t, PERSON_ACCENTS))
    .join(" ");
}

export function restoreClubAccents(raw: string): string {
  return String(raw || "")
    .split(/\s+/)
    .map((t) => restoreToken(t, { ...PERSON_ACCENTS, ...CLUB_ACCENTS }))
    .join(" ");
}

export function isJunkField(value: string | null | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v.length < 2) return true;
  if (v.length > 80) return true;
  if (isCometPageHeader(v)) return true;
  if (JUNK_FIELD_RE.test(v)) return true;
  if (/^\d{1,4}$/.test(v) && Number(v) < 1000) return true;
  if (/Hora:|Impreso por:/i.test(v)) return true;
  return false;
}

export function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Extrae valor de label y corta ante el siguiente label conocido. */
export function fieldValue(text: string, labels: RegExp[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label.source}\\s*[:\\-]?\\s*([^\\n]{2,160}?)(?=\\s+(?:${STOP_LABELS})\\s*[:\\-]|\\n|$)`,
      "i",
    );
    const match = text.match(re);
    if (match?.[1]) {
      const value = cleanLine(match[1].replace(/[|•].*$/, ""));
      if (
        /^(Club|Competici[oó]n|Equipo|Local|Visitante|Fecha|Hora|Impreso|Tipo|Descripci[oó]n|Motivo|N[uú]m|N[uú]mero|Decisi[oó]n|Partido|Categor[ií]a|Divisi[oó]n|Infractor|Entrenador|Jugador|Oficial)\b/i.test(
          value,
        )
      ) {
        continue;
      }
      if (value.length >= 2 && !isJunkField(value)) return value;
    }
  }
  return null;
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  const lower = word.toLocaleLowerCase("es-AR");
  if (/^(de|del|la|las|los|y|e|da|do|dos|das)$/i.test(lower)) return lower;
  return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1);
}

export function hasUserCapitalization(value: string): boolean {
  let sawLower = false;
  let sawUpper = false;
  for (const ch of value) {
    if (!/\p{L}/u.test(ch)) continue;
    const low = ch.toLocaleLowerCase("es-AR");
    const up = ch.toLocaleUpperCase("es-AR");
    if (low === up) continue;
    if (ch === low) sawLower = true;
    if (ch === up) sawUpper = true;
    if (sawLower && sawUpper) return true;
  }
  return false;
}

export function formatPersonName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = cleanLine(raw);
  const infractor = v.match(
    /(?<!Tipo\s+de\s)\bInfractor\s*[:\-]\s*([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü ,.'´\-]+?)(?=\s+Club\s*[:\-]|$)/i,
  );
  if (infractor) v = cleanLine(infractor[1]!);
  if (isJunkField(v) && !/,/.test(v)) return null;

  if (/,/.test(v)) {
    const parts = v
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[0]!;
      const first = parts.slice(1).join(" ");
      if (first && last) v = `${first} ${last}`;
    }
  } else {
    const tokens = v.split(/\s+/);
    const allCaps =
      tokens.length >= 2 &&
      tokens.every((t) => t === t.toLocaleUpperCase("es-AR"));
    if (allCaps && /^(DI|DE|DEL)$/i.test(tokens[0]!) && tokens.length >= 3) {
      const last = tokens.slice(0, 2).join(" ");
      const first = tokens.slice(2).join(" ");
      if (first) v = `${first} ${last}`;
    }
  }

  if (!hasUserCapitalization(v)) {
    v = v
      .split(/\s+/)
      .map(titleCaseWord)
      .join(" ")
      .replace(/\bDi\b/g, "Di")
      .replace(/\bDe\b/g, "de")
      .replace(/\bDel\b/g, "del");
    v = v.replace(
      /\bdi\s+([a-záéíóúñ])/gi,
      (_m, c: string) => `Di ${c.toLocaleUpperCase("es-AR")}`,
    );
  }

  if (v.length < 3 || isJunkField(v)) return null;
  if (/:/.test(v)) return null;
  if (/\binfractor\b|\bclub\b|\bcompetici/i.test(v)) return null;
  if (/^caso\b/i.test(v)) return null;
  if (/\b\d{1,2}(ra|ta|ma|va|na)\.?\b/i.test(v)) return null;
  if (/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(v)) return null;
  if (!hasUserCapitalization(String(raw || ""))) {
    v = restorePersonAccents(v);
  }
  return v;
}

const CLUB_SHORTEN_RULES: { pattern: RegExp; result: string }[] = [
  { pattern: /^atl[eé]tico\s+talleres\s*r\.?\s*e\.?/i, result: "Talleres" },
  { pattern: /^atl[eé]tico\s+estudiantes/i, result: "Estudiantes" },
  { pattern: /^atl[eé]tico\s+independiente/i, result: "Independiente" },
  { pattern: /^atl[eé]tico\s+boca\s+juniors/i, result: "Boca Juniors" },
  { pattern: /^atl[eé]tico\s+san\s+lorenzo/i, result: "San Lorenzo" },
  { pattern: /^atl[eé]tico\s+river\s+plate/i, result: "River Plate" },
  { pattern: /^atl[eé]tico\s+platense/i, result: "Platense" },
  { pattern: /^atl[eé]tico\s+lan[uú]s/i, result: "Lanús" },
  { pattern: /^atl[eé]tico\s+hurac[aá]n/i, result: "Huracán" },
  { pattern: /^atl[eé]tico\s+banfield/i, result: "Banfield" },
  { pattern: /^atl[eé]tico\s+tigre/i, result: "Tigre" },
];

function applyClubShortenRule(v: string): string | null {
  const trimmed = String(v || "").trim();
  if (!trimmed) return null;
  for (const { pattern, result } of CLUB_SHORTEN_RULES) {
    if (pattern.test(trimmed)) return result;
  }
  return null;
}

export function formatClubName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = cleanLine(raw);
  if (isCometPageHeader(v)) return null;
  const clubField = v.match(
    /Club\s*:\s*([A-ZÁÉÍÓÚÑÜ][^|]{2,80}?)(?=\s+Competici|\s+Local|\s+Fecha|$)/i,
  );
  if (clubField) v = cleanLine(clubField[1]!);
  if (isCometPageHeader(v) || isJunkField(v)) return null;

  v = v.replace(/\s+\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s*$/u, "").trim();
  v = v.replace(/\s+\d{1,2}(ra|ta|ma|va|na)\.?\s*$/i, "").trim();
  v = v.replace(/^club\s+/i, "").trim();
  const shortened = applyClubShortenRule(v);
  if (shortened) v = shortened;

  v = v
    .split(/\s+/)
    .map((w) => {
      if (/^(F\.C\.|A\.C\.|LPF)$/i.test(w)) return w.toUpperCase();
      if (/^[A-Za-z](?:\.[A-Za-z])+\.?$/.test(w)) {
        const core = w
          .replace(/\.$/, "")
          .split(".")
          .filter(Boolean)
          .map((p) => p.toLocaleUpperCase("es-AR"))
          .join(".");
        return `${core}.`;
      }
      return titleCaseWord(w);
    })
    .join(" ");

  v = v.replace(/\(([^)]+)\)/g, (_m, inner: string) => {
    const loc = inner
      .split(/\s+/)
      .map(titleCaseWord)
      .join(" ");
    return `(${loc})`;
  });

  if (!hasUserCapitalization(String(raw || ""))) {
    v = restoreClubAccents(v);
  }
  return v || null;
}

export function formatMatchDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = cleanLine(raw);
  const m = v.match(/(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})/);
  if (!m) return null;
  if (/impreso\s+por/i.test(v) && !/fecha/i.test(v)) return null;
  const d = m[1]!.padStart(2, "0");
  const mo = m[2]!.padStart(2, "0");
  let y = m[3]!;
  if (y.length === 2) y = `20${y}`;
  return `${d}/${mo}/${y}`;
}

export function parseMatchFolderName(raw: string | null | undefined): {
  homeClub: string | null;
  awayClub: string | null;
  expedienteHint: string | null;
} {
  if (!raw) return { homeClub: null, awayClub: null, expedienteHint: null };
  let name = raw.trim();
  const expMatch = name.match(
    /(?:^|[\s\-–—])(\d{2,6}(?:\.\d+)?)(?:\s+\d{3,4})?\s*$/,
  );
  const expedienteHint = expMatch?.[1] ?? null;
  if (expMatch) {
    name = name
      .slice(0, expMatch.index)
      .replace(/[,;\s\-–—]+$/g, "")
      .trim();
  }
  name = name.replace(/\s+\d{3,6}(?:\s+\d{3,4})?\s*$/g, "").trim();

  const parts = name.split(/\s+vs\.?\s+|\s+c\.\s+|\s+[–—]\s+|\s+-\s+/i);
  if (parts.length >= 2) {
    return {
      homeClub: parts[0]!.trim() || null,
      awayClub: parts.slice(1).join(" - ").trim() || null,
      expedienteHint,
    };
  }
  return { homeClub: null, awayClub: null, expedienteHint };
}

/**
 * Carpeta de partido real (Local c. Visitante [exp]), no categoría
 * (`4TA`, `0001`) ni contenedores (`Informes`, `Casos`).
 */
export function isMatchFolderName(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const name = raw.trim();
  if (!name) return false;
  if (/^informes?$/i.test(name)) return false;
  if (/^casos?$/i.test(name)) return false;
  // Ordinales de categoría: 4TA, 3RA, 1RA, …
  if (/^\d{1,2}(ra|ta|ma|va|na)\.?$/i.test(name)) return false;
  // Carpetas numéricas tipo 0001–0014
  if (/^\d{3,4}$/.test(name)) return false;
  // Contenedores de categoría: "0001 PRIMERA LPF", "4TA DIVISION", …
  if (/^\d{1,4}\s+\S+/i.test(name)) return false;
  if (/^\d{1,2}(ra|ta|ma|va|na)\.?\s+\S+/i.test(name)) return false;

  const parsed = parseMatchFolderName(name);
  return Boolean(parsed.homeClub && parsed.awayClub);
}

export function looksLikeFilenameAsPerson(
  value: string | null | undefined,
): boolean {
  const v = String(value || "").trim();
  if (!v) return true;
  if (/\.pdf$/i.test(v)) return true;
  if (/^caso\b/i.test(v)) return true;
  if (/^informe\b/i.test(v)) return true;
  if (/^decisi[oó]n\s+de\s+caso/i.test(v)) return true;
  if (/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(v)) return true;
  if (/\b\d{1,2}(ra|ta|ma|va|na)\.?\b/i.test(v)) return true;
  if (/[/\\]/.test(v)) return true;
  if (v.length > 60) return true;
  return false;
}

export function isGenericStaffTipoLabel(role: string): boolean {
  return /^(entrenador|cuerpo\s*t[eé]cnico|staff|personal\s+auxiliar)$/i.test(
    role,
  );
}
