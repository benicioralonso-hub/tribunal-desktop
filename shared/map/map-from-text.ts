/**
 * Mapeo clásico COMET (sin IA): local, visitante, infractor, club, rol, fecha.
 * Autocontenido para Electron workers.
 */

export type MapFacts = {
  person: string | null;
  club: string | null;
  role: string | null;
  homeClub: string | null;
  awayClub: string | null;
  matchDate: string | null;
  competition: string | null;
  kind: "caso" | "informe" | "otro";
  confidence: number;
};

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function titleCasePerson(raw: string): string | null {
  let v = clean(raw)
    .replace(/^Infractor\s*[:\-]?\s*/i, "")
    .replace(/\s+(Club|Competici|Tipo|Partido|Fecha).*$/i, "")
    .trim();
  if (v.length < 4 || v.length > 90) return null;
  if (/^(club|tipo|partido|fecha|competici)/i.test(v)) return null;
  if (!/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]{2,}/.test(v)) return null;

  const fix = (x: string) =>
    x
      .toLowerCase()
      .replace(/(^|[\s.'-])(\S)/g, (_, a, b: string) => a + b.toUpperCase());

  // COMET suele venir "APELLIDOS, NOMBRES"
  if (v.includes(",")) {
    const [last, ...rest] = v.split(",").map((p) => p.trim());
    const first = rest.join(" ").trim();
    if (!last || !first) return null;
    return `${fix(first)} ${fix(last)}`.trim();
  }

  // Sin coma: no cortar por ; o | si parece un solo nombre
  v = v.replace(/[;|].*$/, "").trim();
  return fix(v);
}

function formatClub(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = clean(raw)
    .replace(/^Club\s*[:\-]?\s*/i, "")
    .replace(/\s+(Competici|Disciplina|Partido|Fecha|Tipo|Infractor).*$/i, "")
    .trim();
  if (v.length < 2 || v.length > 90) return null;
  if (/^(competici|partido|fecha|tipo|infractor)/i.test(v)) return null;
  return v;
}

function parsePartido(text: string): { home: string | null; away: string | null } {
  const line =
    text.match(
      /Partido\s*[:\-]?\s*([^\n\r]{5,160})/i,
    )?.[1] ||
    text.match(
      /([A-ZÁÉÍÓÚÑÜ0-9][^\n]{2,70}?)\s+(?:c\.|contra|vs\.?|-)\s+([A-ZÁÉÍÓÚÑÜ0-9][^\n]{2,70})/i,
    )?.[0];

  if (!line) return { home: null, away: null };
  const m = clean(line).match(
    /^(.+?)\s+(?:c\.|contra|vs\.?|–|—|-)\s+(.+?)(?:\s+\d{1,2}[./]\d{1,2}.*)?$/i,
  );
  if (!m) return { home: null, away: null };
  return {
    home: formatClub(m[1]),
    away: formatClub(m[2]),
  };
}

function parseFolderClubs(folderName: string): {
  home: string | null;
  away: string | null;
} {
  const m = folderName.match(
    /^(.+?)\s+(?:-|c\.|contra|vs\.?)\s+(.+?)(?:\s+\d{3,}.*)?$/i,
  );
  if (!m) return { home: null, away: null };
  return { home: formatClub(m[1]), away: formatClub(m[2]) };
}

function extractInfractor(text: string): string | null {
  const same = text.match(
    /(?<!Tipo\s+de\s)\bInfractor\s*[:\-]?\s*([^\n\r]{3,90}?)(?=\s+(?:Club|Competici|Tipo|Partido|Fecha|Hora|N[uú]m)\b|$)/im,
  )?.[1];
  if (same) {
    const p = titleCasePerson(same);
    if (p) return p;
  }
  const named = text.match(
    /Nombre\s+del\s+infractor\s*[:\-]?\s*([^\n\r]{3,90})/i,
  )?.[1];
  return named ? titleCasePerson(named) : null;
}

function extractClubInfractor(text: string): string | null {
  const m =
    text.match(
      /Club\s+del\s+infractor\s*[:\-]?\s*([^\n\r]{2,90})/i,
    )?.[1] ||
    text.match(
      /(?:^|\n)\s*Club\s*[:\-]?\s*([^\n\r]{2,90}?)(?=\s+(?:Competici|Disciplina|Partido|Fecha|Tipo|Infractor)|$)/im,
    )?.[1];
  return formatClub(m);
}

function extractRole(text: string): string | null {
  const raw =
    text.match(
      /Tipo\s+de\s+infractor\s*[:\-]?\s*([^\n\r]{2,80})/i,
    )?.[1] || "";
  const head = clean(raw).slice(0, 80);
  const rules: Array<[RegExp, string]> = [
    [/^jugadora\b/i, "jugadora"],
    [/^jugador\b/i, "jugador"],
    [/^directora\s*t[eé]cnica\b/i, "directora técnica"],
    [/^director\s*t[eé]cnico\b/i, "director técnico"],
    [/^cuerpo\s*t[eé]cnic/i, "cuerpo técnico"],
    [/^entrenadora?\b/i, "entrenador"],
    [/^delegada\b/i, "delegada"],
    [/^delegado\b/i, "delegado"],
    [/^m[eé]dica\b/i, "médica"],
    [/^m[eé]dico\b/i, "médico"],
    [/^kinesi[oó]loga\b/i, "kinesióloga"],
    [/^kinesi/i, "kinesiólogo"],
    [/^utilera\b/i, "utilera"],
    [/^utilero\b/i, "utilero"],
    [/^aguatera\b/i, "aguatera"],
    [/^aguatero\b/i, "aguatero"],
    [/^funcionari/i, "funcionario"],
  ];
  for (const [re, role] of rules) {
    if (re.test(head)) return role;
  }
  if (/tarjeta\s*roja|doble\s*amonest/i.test(text)) return "jugador";
  return null;
}

function extractDate(text: string): string | null {
  const m =
    text.match(
      /Fecha\s+(?:y\s+hora|del\s+partido)\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
    )?.[1] ||
    text.match(/(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})/)?.[1];
  return m ? m.replace(/[.\-]/g, "/") : null;
}

function extractCompetition(text: string): string | null {
  const m = text.match(/Competici[oó]n\s*[:\-]?\s*([^\n\r]{3,100})/i)?.[1];
  if (!m) return null;
  const v = clean(m).replace(/\s+(Disciplina|Partido|Fecha|Club).*$/i, "");
  return v.length >= 3 ? v : null;
}

export function classifyPdfText(text: string): "caso" | "informe" | "otro" {
  const t = text.toLowerCase();
  if (/informe\s+del\s+partido|match\s+report/.test(t)) return "informe";
  if (
    /caso\s+disciplinari|decisi[oó]n\s+de\s+caso|infractor\s*:/.test(t)
  ) {
    return "caso";
  }
  return "otro";
}

export function mapFactsFromText(
  text: string,
  hints?: { folderName?: string },
): MapFacts {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  const kind = classifyPdfText(normalized);
  if (normalized.trim().length < 20) {
    return {
      person: null,
      club: null,
      role: null,
      homeClub: null,
      awayClub: null,
      matchDate: null,
      competition: null,
      kind,
      confidence: 0,
    };
  }

  const fromPartido = parsePartido(normalized);
  const fromFolder = hints?.folderName
    ? parseFolderClubs(hints.folderName)
    : { home: null, away: null };

  const homeClub = fromPartido.home || fromFolder.home;
  const awayClub = fromPartido.away || fromFolder.away;
  const person = extractInfractor(normalized);
  const club = extractClubInfractor(normalized);
  const role = extractRole(normalized);
  const matchDate = extractDate(normalized);
  const competition = extractCompetition(normalized);

  let confidence = 20;
  if (person) confidence += 25;
  if (club) confidence += 15;
  if (homeClub && awayClub) confidence += 15;
  if (role) confidence += 15;
  if (matchDate) confidence += 10;

  return {
    person,
    club,
    role,
    homeClub,
    awayClub,
    matchDate,
    competition,
    kind,
    confidence: Math.min(95, confidence),
  };
}

export function mergeCasoInforme(
  caso: MapFacts | null,
  informe: MapFacts | null,
  folderName: string,
): Omit<MapFacts, "kind"> {
  const folder = parseFolderClubs(folderName);
  return {
    person: caso?.person || informe?.person || null,
    club: caso?.club || informe?.club || null,
    role: caso?.role || informe?.role || null,
    homeClub:
      caso?.homeClub || informe?.homeClub || folder.home || null,
    awayClub:
      caso?.awayClub || informe?.awayClub || folder.away || null,
    matchDate: caso?.matchDate || informe?.matchDate || null,
    competition: caso?.competition || informe?.competition || null,
    confidence: Math.max(caso?.confidence ?? 0, informe?.confidence ?? 0),
  };
}
