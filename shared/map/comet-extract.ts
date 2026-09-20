/**
 * Extracción clásica COMET — port autocontenido del núcleo de
 * tribunal-app `lib/comet-extract.ts` (sin Drive/IA).
 */

import {
  cleanLine,
  fieldValue,
  formatClubName,
  formatMatchDate,
  formatPersonName,
  isCometPageHeader,
  isGenericStaffTipoLabel,
  isJunkField,
  parseMatchFolderName,
} from "./sanitize";

export type CometFacts = {
  person: string | null;
  club: string | null;
  role: string | null;
  offenseSummary: string | null;
  tipoEvento: string | null;
  matchDate: string | null;
  homeClub: string | null;
  awayClub: string | null;
  competition: string | null;
  extractedPersons: string[];
  signals: string[];
  confidence: number;
};

const TABLE_LABEL_ONLY_RE =
  /^(Tipo\s+de\s+infractor|Nombre\s+del\s+infractor|Infractor|Club(?:\s+del\s+infractor)?|Competici[oó]n|Equipo(?:\s+local|\s+visitante)?|Local|Visitante|Fecha(?:\s+del\s+partido)?|Hora|Impreso(?:\s+por)?|Tipo(?:\s+de\s+(?:evento|sanci[oó]n|infractor))?|Descripci[oó]n(?:\s+de\s+(?:la\s+)?infracci[oó]n)?|Motivo|N[uú]m(?:ero|\.?)?|Decisi[oó]n(?:\s+de\s+caso)?|Partido|Categor[ií]a|Divisi[oó]n|Entrenador\s+expulsado|Oficial(?:es)?|Expulsado|Alineaciones)\s*[:\-]?$/i;

const ROLE_VALUE_RE =
  /^(jugador(?:a)?|entrenador(?:a)?|director\s+t[eé]cnico|preparador\s+f[ií]sico|personal\s+auxiliar|delegado|kinesi[oó]logo|m[eé]dico|oficial|staff|cuerpo\s*t[eé]cnico|funcionari[oa]s?|s[ií]|no)$/i;

const COMET_PERSON_CELL_RE =
  /^([A-ZÁÉÍÓÚÑÜ]{2,}(?:\s+(?:DE|DEL|DI|DA|DO|DOS|DAS|[A-ZÁÉÍÓÚÑÜ]{2,})){0,4}\s*,\s*[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü .'´\-]{1,60})$/;

const COMPETITION_LINE_RE =
  /\b(?:torneo|campeonato|copa|juveniles?|primera|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|reserva|promocional|futsal|categor[ií]a|sub\.?\s*\d{2}|liga\s+profesional)\b/i;

const CLUB_STOP_TOKENS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "e",
  "club",
  "atletico",
  "asociacion",
  "social",
  "deportivo",
  "futbol",
  "fc",
  "ac",
]);

function stripTrailingFieldLabels(raw: string): string {
  return cleanLine(
    raw.replace(
      /\s+(Club|Competici[oó]n|Tipo|Partido|Fecha|Hora|N[uú]m(?:ero|\.?)?|Descripci[oó]n|Equipo|Local|Visitante)\s*[:\-].*$/i,
      "",
    ),
  );
}

function parseTipoInfractorCell(raw: string | null | undefined): string | null {
  const v = stripTrailingFieldLabels(String(raw || "")).replace(/\s+/g, " ").trim();
  if (!v) return null;
  if (/oficiales\s+de\s+partido/i.test(v)) return null;
  const head = v.slice(0, 80);
  const rules: Array<{ re: RegExp; role: string }> = [
    { re: /^jugadora\b/i, role: "jugadora" },
    { re: /^jugador\b/i, role: "jugador" },
    { re: /^directora\s*t[eé]cnica\b/i, role: "directora técnica" },
    { re: /^director\s*t[eé]cnico\b/i, role: "director técnico" },
    { re: /^cuerpo\s*t[eé]cnic/i, role: "cuerpo técnico" },
    { re: /^funcionari/i, role: "funcionario" },
    { re: /^entrenadora?\b/i, role: "entrenador" },
    { re: /^preparadora?\s*f[ií]sic/i, role: "preparador físico" },
    { re: /^personal\s+auxiliar\b/i, role: "personal auxiliar" },
    { re: /^delegada\b/i, role: "delegada" },
    { re: /^delegado\b/i, role: "delegado" },
    { re: /^kinesi[oó]loga\b/i, role: "kinesióloga" },
    { re: /^kinesi/i, role: "kinesiólogo" },
    { re: /^aguatera\b/i, role: "aguatera" },
    { re: /^aguatero\b/i, role: "aguatero" },
    { re: /^utilera\b/i, role: "utilera" },
    { re: /^utilero\b/i, role: "utilero" },
    { re: /^m[eé]dica\b/i, role: "médica" },
    { re: /^m[eé]dico\b/i, role: "médico" },
    { re: /^oficial(?!es)\b/i, role: "oficial" },
  ];
  for (const rule of rules) {
    if (rule.re.test(head)) return rule.role;
  }
  return null;
}

function roleFromSnippet(snippet: string | null | undefined): string | null {
  return parseTipoInfractorCell(snippet);
}

export function looksLikeClubMatchupValue(raw: string): boolean {
  const v = cleanLine(raw);
  if (!v) return false;
  if (/\s+(?:c\.|vs\.?|contra)\s+/i.test(v)) return true;
  const parts = v.split(/\s+[–—]\s+|\s+-\s+/);
  if (parts.length >= 2) {
    const left = parts[0]!.trim();
    const right = parts.slice(1).join(" ").trim();
    if (left.length >= 3 && right.length >= 3) return true;
  }
  return false;
}

function foldClubCompare(raw: string | null | undefined): string {
  return String(formatClubName(raw) || raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(club|atletico|asociacion|social|deportivo|futbol)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distinctiveClubTokens(fold: string): string[] {
  return fold
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        !CLUB_STOP_TOKENS.has(t) &&
        (t.length >= 3 || (t.length === 2 && /^[a-z]{2}$/.test(t))),
    );
}

function overlapClubTokens(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let n = 0;
  for (const t of a) {
    if (setB.has(t)) {
      n += 1;
      continue;
    }
    if (t.length === 2) {
      for (const other of setB) {
        if (other.length >= 3 && other.startsWith(t[0]!)) {
          n += 0.5;
          break;
        }
      }
    }
  }
  return n;
}

function firstTokenIndex(fold: string, tokens: string[]): number {
  let best = -1;
  for (const t of tokens) {
    const i = fold.indexOf(t);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

export function preferClubNameFromPartido(
  clubRaw: string | null | undefined,
  homeClub: string | null | undefined,
  awayClub: string | null | undefined,
): string | null {
  const club =
    formatClubName(clubRaw) || (clubRaw ? cleanLine(String(clubRaw)) : null);
  const home =
    formatClubName(homeClub) || (homeClub ? cleanLine(String(homeClub)) : null);
  const away =
    formatClubName(awayClub) || (awayClub ? cleanLine(String(awayClub)) : null);
  if (!club) return null;
  if (!home && !away) return club;

  const clubFold = foldClubCompare(club);
  if (!clubFold) return club;

  const homeFold = foldClubCompare(home);
  const awayFold = foldClubCompare(away);
  const clubTokens = distinctiveClubTokens(clubFold);
  const homeTokens = distinctiveClubTokens(homeFold);
  const awayTokens = distinctiveClubTokens(awayFold);
  const homeScore = overlapClubTokens(clubTokens, homeTokens);
  const awayScore = overlapClubTokens(clubTokens, awayTokens);

  if (homeScore > 0 && awayScore === 0 && home) return home;
  if (awayScore > 0 && homeScore === 0 && away) return away;
  if (homeScore > awayScore && home) return home;
  if (awayScore > homeScore && away) return away;

  if (homeScore > 0 && awayScore > 0 && home && away) {
    const homePos = firstTokenIndex(clubFold, homeTokens);
    const awayPos = firstTokenIndex(clubFold, awayTokens);
    if (homePos >= 0 && (awayPos < 0 || homePos < awayPos)) return home;
    if (awayPos >= 0 && (homePos < 0 || awayPos < homePos)) return away;
  }

  return club;
}

function extractStackedCometValue(
  text: string,
  labelMatcher: RegExp,
  isValue: (line: string) => boolean,
): string | null {
  const lines = String(text || "")
    .replace(/\u0000/g, " ")
    .split(/\r?\n/)
    .map((l) => cleanLine(l))
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (!TABLE_LABEL_ONLY_RE.test(lines[i]!)) continue;
    const labels: string[] = [];
    let j = i;
    while (j < lines.length && TABLE_LABEL_ONLY_RE.test(lines[j]!)) {
      labels.push(lines[j]!.replace(/\s*[:\-]\s*$/, "").trim());
      j += 1;
    }
    if (labels.length < 3) continue;
    const idx = labels.findIndex((lab) => labelMatcher.test(lab));
    if (idx < 0) continue;

    const values: string[] = [];
    for (let k = j; k < lines.length && values.length < labels.length; k++) {
      const line = lines[k]!;
      if (TABLE_LABEL_ONLY_RE.test(line) && values.length > 0) break;
      values.push(line);
    }
    if (idx >= values.length) continue;
    const v = stripTrailingFieldLabels(values[idx]!);
    if (isValue(v)) return v;
  }
  return null;
}

export function trimClubFieldNoise(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let v = cleanLine(String(raw));
  v = v
    .replace(
      /\s+(Tipo\s+de\s+evento|Descripci[oó]n(?:\s+de\s+infracci[oó]n)?|Competici[oó]n|Disciplina|Fecha|Hora|Infractor|Club|Partido|Impreso)\s*[:\-].*$/i,
      "",
    )
    .trim();
  return v || null;
}

function splitMatchupClubs(raw: string): {
  homeClub: string | null;
  awayClub: string | null;
} {
  let line = cleanLine(raw)
    .replace(
      /\s+(Fecha|Hora|Competici[oó]n|N[uú]m\.?|N[uú]mero|Categor[ií]a|Divisi[oó]n|Infractor|Club|Tipo(?:\s+de\s+evento)?|Descripci[oó]n(?:\s+de\s+infracci[oó]n)?|Impreso|Disciplina)\s*[:\-].*$/i,
      "",
    )
    .trim();
  line = line.replace(/\s+\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}\s*$/, "").trim();
  if (!line || TABLE_LABEL_ONLY_RE.test(line)) {
    return { homeClub: null, awayClub: null };
  }

  const parts = line.split(
    /\s+vs\.?\s+|\s+c\.\s+|\s+contra\s+|\s+[–—]\s+|\s+-\s+/i,
  );
  if (parts.length < 2) return { homeClub: null, awayClub: null };

  const home = trimClubFieldNoise(parts[0]!.trim()) || parts[0]!.trim();
  const away =
    trimClubFieldNoise(
      parts
        .slice(1)
        .join(" - ")
        .replace(/\s+\d{4,6}(?:\.\d+)?\s*$/, "")
        .trim(),
    ) ||
    parts
      .slice(1)
      .join(" - ")
      .replace(/\s+\d{4,6}(?:\.\d+)?\s*$/, "")
      .trim();

  return {
    homeClub: formatClubName(home) || (home ? cleanLine(home) : null),
    awayClub: formatClubName(away) || (away ? cleanLine(away) : null),
  };
}

function looksLikeClubMatchupLine(line: string): boolean {
  const t = cleanLine(line);
  if (!t || t.length < 5) return false;
  if (
    /^(fecha|hora|estadio|competic|disciplina|impreso|alineaciones|oficiales)/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/\s(?:c\.|contra|vs\.?)\s/i.test(t)) return true;
  if (/\s[-–—]\s/.test(t) && !COMPETITION_LINE_RE.test(t)) return true;
  return false;
}

function parsePartidoLine(text: string): {
  homeClub: string | null;
  awayClub: string | null;
} {
  const stackedMatchup = extractStackedCometValue(
    text,
    /^Partido$/i,
    (v) => looksLikeClubMatchupValue(v),
  );
  if (stackedMatchup) {
    const fromStack = splitMatchupClubs(stackedMatchup);
    if (fromStack.homeClub && fromStack.awayClub) return fromStack;
  }

  const labelRe = /(?<!(?:del|fecha|informe)\s)\bPartido\s*[:\-]?\s*/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = labelRe.exec(text))) {
    const after = text.slice(labelMatch.index + labelMatch[0].length);
    const sameLine = after.match(/^([^\n\r]{5,180})/);
    if (sameLine?.[1] && !TABLE_LABEL_ONLY_RE.test(cleanLine(sameLine[1]))) {
      const fromSame = splitMatchupClubs(sameLine[1]);
      if (fromSame.homeClub && fromSame.awayClub) return fromSame;
    }
    const lines = after
      .split(/\r?\n/)
      .map((l) => cleanLine(l))
      .filter(Boolean);
    for (const line of lines.slice(0, 28)) {
      if (TABLE_LABEL_ONLY_RE.test(line)) continue;
      if (!looksLikeClubMatchupValue(line) && !looksLikeClubMatchupLine(line)) {
        continue;
      }
      const fromLine = splitMatchupClubs(line);
      if (fromLine.homeClub && fromLine.awayClub) return fromLine;
    }
  }

  return { homeClub: null, awayClub: null };
}

function parseMatchClubs(
  text: string,
  fallbackMatch?: string,
): {
  homeClub: string | null;
  awayClub: string | null;
} {
  const fromPartido = parsePartidoLine(text);
  if (fromPartido.homeClub && fromPartido.awayClub) {
    return fromPartido;
  }

  let home =
    fromPartido.homeClub ||
    fieldValue(text, [/(?:equipo\s+local)\b/i, /home\s+team/i]) ||
    text.match(
      /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñü0-9 .''()\-]{2,40})\s+c\.\s+/,
    )?.[1] ||
    null;
  let away =
    fromPartido.awayClub ||
    fieldValue(text, [/(?:equipo\s+visitante)\b/i, /away\s+team/i]) ||
    text.match(
      /\s+c\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñü0-9 .''()\-]{2,40})/,
    )?.[1] ||
    null;

  if ((!home || !away) && fallbackMatch) {
    const folder = parseMatchFolderName(fallbackMatch);
    home = home || folder.homeClub;
    away = away || folder.awayClub;
  }

  return {
    homeClub: formatClubName(home) || (home ? cleanLine(home) : null),
    awayClub: formatClubName(away) || (away ? cleanLine(away) : null),
  };
}

function looksLikePersonCandidate(raw: string): boolean {
  const v = cleanLine(raw);
  if (v.length < 5 || v.length > 90) return false;
  if (isJunkField(v) && !/,/.test(v)) return false;
  if (
    /club|partido|competici|fecha|hora|impreso|decisi[oó]n|informe|expte|\binfractor\b/i.test(
      v,
    )
  ) {
    return false;
  }
  if (/,/.test(v)) return /[A-ZÁÉÍÓÚÑÜ]{2,}/.test(v);
  const tokens = v.split(/\s+/);
  return tokens.length >= 2 && tokens.length <= 7;
}

function looksLikeCometPersonCell(raw: string): boolean {
  const v = stripTrailingFieldLabels(raw);
  if (!v || ROLE_VALUE_RE.test(v) || TABLE_LABEL_ONLY_RE.test(v)) return false;
  if (COMET_PERSON_CELL_RE.test(v)) return true;
  return looksLikePersonCandidate(v) && /,/.test(v);
}

function looksLikeClubCell(raw: string): boolean {
  const v = stripTrailingFieldLabels(raw);
  if (!v || v.length < 3 || v.length > 80) return false;
  if (TABLE_LABEL_ONLY_RE.test(v) || ROLE_VALUE_RE.test(v)) return false;
  if (/^clubs?$/i.test(v)) return false;
  if (isCometPageHeader(v)) return false;
  if (looksLikeCometPersonCell(v)) return false;
  if (looksLikeClubMatchupValue(v)) return false;
  if (/^\d{1,4}$/.test(v)) return false;
  if (/impreso|hora:|decisi[oó]n de caso/i.test(v)) return false;
  return true;
}

function pickTipoInfractorCandidate(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  const parsed = candidates
    .map((raw) => ({ raw, role: parseTipoInfractorCell(raw) }))
    .filter((x): x is { raw: string; role: string } => Boolean(x.role));
  if (parsed.length === 0) return null;
  const player = parsed.find(
    (x) => x.role === "jugador" || x.role === "jugadora",
  );
  const staffGeneric = parsed.find((x) => isGenericStaffTipoLabel(x.role));
  const staffSpecific = parsed.find(
    (x) =>
      x.role !== "jugador" &&
      x.role !== "jugadora" &&
      !isGenericStaffTipoLabel(x.role),
  );
  const bleed = parsed.some((x) =>
    /^(médico|médica|kinesiólogo|kinesióloga|oficial)$/.test(x.role),
  );
  if (player && bleed) return player.raw;
  if (staffSpecific) return staffSpecific.raw;
  if (staffGeneric) return staffGeneric.raw;
  return parsed[0]!.raw;
}

export function extractTipoInfractorRaw(text: string): string | null {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  const re = /tipo\s+de\s+infractor\s*[:\-]?\s*/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = re.exec(normalized))) {
    const after = normalized.slice(labelMatch.index + labelMatch[0].length);
    const candidates: string[] = [];
    const pushVal = (raw: string) => {
      const v = stripTrailingFieldLabels(raw);
      if (!v || TABLE_LABEL_ONLY_RE.test(v)) return;
      if (/oficiales\s+de\s+partido/i.test(v)) return;
      if (parseTipoInfractorCell(v)) candidates.push(v);
    };
    const sameLine = after.match(
      /^([^\n\r]{1,160}?)(?=\s+(?:Club|Competici|Tipo|Partido|Fecha|Hora|N[uú]m|Infractor|Disciplina|Expulsado)\s*[:\-]|\s*$|\r?\n)/i,
    );
    if (sameLine?.[1]) pushVal(sameLine[1]);
    const lines = after
      .split(/\r?\n/)
      .map((l) => cleanLine(l))
      .filter(Boolean);
    for (const line of lines.slice(0, 4)) {
      if (/descripci[oó]n\s+de|tarjeta/i.test(line)) break;
      if (/oficiales\s+de\s+partido|alineaciones/i.test(line)) continue;
      if (TABLE_LABEL_ONLY_RE.test(line)) continue;
      if (
        /^(Infractor|Club|Competici|Tipo|Partido|Fecha|Disciplina)\s*[:\-]/i.test(
          line,
        )
      ) {
        break;
      }
      pushVal(line);
    }
    const picked = pickTipoInfractorCandidate(candidates);
    if (picked) return picked;
  }
  return null;
}

function isTrailingClubWordWrap(text: string, labelIndex: number): boolean {
  const prev =
    text
      .slice(0, labelIndex)
      .split(/\r?\n/)
      .map((l) => cleanLine(l))
      .filter(Boolean)
      .pop() || "";
  if (!prev) return false;
  return /\s(?:[-–—]|c\.|vs\.?|contra)\s+[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü .''()]{1,40}$/i.test(
    prev,
  );
}

function extractInlineClubAfterInfractor(text: string): string | null {
  const m = text.match(
    /\bInfractor\s*[:\-]\s*[^\n]{2,120}?\s+Club\s*[:\-]\s*([^\n]{2,120}?)(?=\s+Competici[oó]n\s*[:\-]|\s+Disciplina\s*[:\-]|\s+Fecha\s*[:\-]|\s+Partido\s*[:\-]|\s+Tipo\s+de\s)/i,
  );
  if (!m?.[1]) return null;
  const v = stripTrailingFieldLabels(cleanLine(m[1]));
  if (!v || !looksLikeClubCell(v) || looksLikeClubMatchupValue(v)) return null;
  return v;
}

export function extractClubDelInfractorRaw(text: string): string | null {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  const inline = extractInlineClubAfterInfractor(normalized);
  if (inline) return inline;

  type ClubHit = {
    value: string;
    source: "labeled" | "bare" | "stacked" | "inline";
  };
  const candidates: ClubHit[] = [];
  const push = (raw: string | null | undefined, source: ClubHit["source"]) => {
    if (!raw) return;
    let v = stripTrailingFieldLabels(cleanLine(raw));
    if (!v) return;
    if (looksLikeClubMatchupValue(v)) return;
    if (/^atl[eé]tico\b/i.test(v) && !/^club\s+/i.test(v)) {
      v = `Club ${v}`;
    }
    if (!looksLikeClubCell(v)) return;
    if (candidates.some((c) => c.value.toLowerCase() === v.toLowerCase()))
      return;
    candidates.push({ value: v, source });
  };

  const walkAfter = (after: string, source: ClubHit["source"], max = 28) => {
    const sameLine = after.match(
      /^([^\n\r]{1,160}?)(?=\s+(?:Club|Competici|Tipo|Partido|Fecha|Hora|N[uú]m|Infractor|Disciplina|Expulsado)\s*[:\-]|\s*$|\r?\n)/i,
    );
    if (sameLine?.[1]) push(sameLine[1], source);
    const lines = after
      .split(/\r?\n/)
      .map((l) => cleanLine(l))
      .filter(Boolean);
    for (const line of lines.slice(0, max)) {
      if (TABLE_LABEL_ONLY_RE.test(line)) continue;
      if (looksLikeClubMatchupValue(line)) continue;
      if (
        /^(Infractor|Club|Competici|Tipo|Partido|Fecha|Disciplina)\s*[:\-]/i.test(
          line,
        )
      ) {
        if (/:\s*\S/.test(line)) break;
        continue;
      }
      push(line, source);
      if (candidates.some((c) => c.source === source)) break;
    }
  };

  const stacked = extractStackedCometValue(
    normalized,
    /^(?:Club(?:\s+del\s+infractor)?)$/i,
    (v) => looksLikeClubCell(v) && !looksLikeClubMatchupValue(v),
  );
  if (stacked) push(stacked, "stacked");

  const colonRe =
    /(?:^|\n)\s*(?:club\s+del\s+infractor\s*[:\-]|club\s*:)\s*/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = colonRe.exec(normalized))) {
    walkAfter(
      normalized.slice(labelMatch.index + labelMatch[0].length),
      "labeled",
    );
  }

  const bareRe = /(?:^|\n)\s*club\s*(?=\r?\n|$)/gi;
  while ((labelMatch = bareRe.exec(normalized))) {
    if (isTrailingClubWordWrap(normalized, labelMatch.index)) continue;
    const after = normalized.slice(labelMatch.index + labelMatch[0].length);
    const next =
      after
        .split(/\r?\n/)
        .map((l) => cleanLine(l))
        .find(Boolean) || "";
    if (/^atl[eé]tico\b/i.test(next)) continue;
    walkAfter(after, "bare");
  }

  if (candidates.length === 0) return null;
  const priority: ClubHit["source"][] = ["inline", "labeled", "stacked", "bare"];
  for (const source of priority) {
    const hit = candidates.find((c) => c.source === source);
    if (hit) return hit.value;
  }
  return candidates[0]?.value || null;
}

export function extractInfractorRaw(text: string): string | null {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  if (!normalized.trim()) return null;

  const labelRe = /(?<!Tipo\s+de\s)\bInfractor\s*[:\-]?\s*/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = labelRe.exec(normalized))) {
    const after = normalized.slice(labelMatch.index + labelMatch[0].length);

    const sameLine = after.match(
      /^([^\n\r]{2,120}?)(?=\s+(?:Club|Competici|Tipo|Partido|Fecha|Hora|N[uú]m)\s*[:\-]|\s*$|\r?\n)/i,
    );
    if (sameLine?.[1]) {
      const v = stripTrailingFieldLabels(sameLine[1]);
      if (looksLikeCometPersonCell(v)) return v;
    }

    const lines = after
      .split(/\r?\n/)
      .map((l) => cleanLine(l))
      .filter(Boolean);
    for (const line of lines.slice(0, 16)) {
      if (TABLE_LABEL_ONLY_RE.test(line)) continue;
      if (ROLE_VALUE_RE.test(line)) continue;
      const v = stripTrailingFieldLabels(line);
      if (looksLikeCometPersonCell(v)) return v;
      if (/^Club\s*[:\-]/i.test(line) && !/^Club\s*[:\-]?\s*$/i.test(line))
        break;
    }
  }

  const named = normalized.match(
    /Nombre\s+del\s+infractor\s*[:\-]?\s*([^\n\r]{3,90})/i,
  )?.[1];
  if (named) {
    const v = stripTrailingFieldLabels(named);
    if (looksLikeCometPersonCell(v) || looksLikePersonCandidate(v)) return v;
  }

  return null;
}

export function extractPersonCandidates(text: string): string[] {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  const found: string[] = [];
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const cleaned = cleanLine(raw.replace(/[|•].*$/, ""));
    if (!looksLikePersonCandidate(cleaned)) return;
    const formatted = formatPersonName(cleaned);
    if (!formatted) return;
    if (found.some((x) => x.toLowerCase() === formatted.toLowerCase())) return;
    found.push(formatted);
  };

  push(extractInfractorRaw(normalized));

  const labeled = [
    ...normalized.matchAll(
      /Nombre\s+del\s+infractor\s*[:\-]?\s*([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü ,.'´\-]{3,90})/gi,
    ),
    ...normalized.matchAll(
      /(?<!Tipo\s+de\s)\bInfractor\s*[:\-]\s*([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü ,.'´\-]{3,90}?)(?=\s+(?:Club|Competici|Tipo|Partido|Fecha|Hora|N[uú]m)\b|$)/gi,
    ),
  ];
  for (const m of labeled) push(m[1]);

  for (const m of normalized.matchAll(
    /(?:^|\n)\s*([A-ZÁÉÍÓÚÑÜ]{2,}(?:\s+(?:DE|DEL|DI|DA|DO|DOS|DAS|[A-ZÁÉÍÓÚÑÜ]{2,})){0,3}\s*,\s*[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü ]{2,60})/g,
  )) {
    push(m[1]);
  }

  return found;
}

function pickPrimaryPerson(text: string): string | null {
  const fromInfractorCell = formatPersonName(extractInfractorRaw(text));
  if (fromInfractorCell) return fromInfractorCell;

  const candidates = extractPersonCandidates(text);
  if (candidates.length > 0) return candidates[0]!;

  const personRaw = fieldValue(String(text || "").replace(/\u0000/g, " "), [
    /nombre\s+del\s+infractor/i,
    /offender\s+name/i,
  ]);
  return formatPersonName(personRaw);
}

function collectSignals(text: string): string[] {
  const signals: string[] = [];
  const lower = text.toLowerCase();
  if (
    /doble\s+(tarjeta\s+)?amarilla|second\s+yellow|doble amonestaci|dos\s+tarjetas\s+amarillas/i.test(
      lower,
    )
  ) {
    signals.push("doble_amonestacion");
  }
  if (/juego\s+brusco\s+grave|serious\s+foul/i.test(lower))
    signals.push("juego_brusco_grave");
  else if (/juego\s+brusco|reckless/i.test(lower)) signals.push("juego_brusco");
  if (
    /conducta\s+violenta|violent\s+conduct|pu[nñ]etazo|patada|codazo|escup/i.test(
      lower,
    )
  ) {
    signals.push("conducta_violenta");
  }
  if (/ocas[ií][oó]n\s+manifesta|dogso|evitar\s+un\s+gol/i.test(lower)) {
    signals.push("ocasión_manifesta");
  }
  if (/desaprobaci[oó]n|protest|insult|ofensiv/i.test(lower))
    signals.push("desaprobacion");
  if (/tarjeta\s+roja|red\s+card|expuls/i.test(lower))
    signals.push("expulsion");
  if (/entrenador\s+expulsado\s*:\s*s[ií]/i.test(lower))
    signals.push("entrenador_expulsado");
  return signals;
}

export function extractCompeticionRaw(text: string): string | null {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  if (!normalized.trim()) return null;

  const looksLikeCompetition = (raw: string): boolean => {
    const v = cleanLine(raw);
    if (
      v.length < 3 ||
      isJunkField(v) ||
      TABLE_LABEL_ONLY_RE.test(v) ||
      /^(f[uú]tbol(?:\s+de\s+playa)?|futsal)$/i.test(v) ||
      looksLikeCometPersonCell(v) ||
      ROLE_VALUE_RE.test(v)
    ) {
      return false;
    }
    if (looksLikeClubMatchupValue(v) && !COMPETITION_LINE_RE.test(v)) {
      return false;
    }
    return true;
  };

  const stacked = extractStackedCometValue(
    normalized,
    /^Competici[oó]n$/i,
    looksLikeCompetition,
  );
  if (stacked) return stacked;

  const labeled =
    fieldValue(normalized, [/competici[oó]n\b/i]) ||
    normalized.match(
      /Competici[oó]n\s*[:\-]\s*([^\n\r]{3,160}?)(?=\s+(?:Disciplina|Partido|Club|Fecha|Hora|Tipo|Infractor|Equipo|Local|Visitante|N[uú]m)\b|\r?\n|$)/i,
    )?.[1] ||
    null;

  if (labeled) {
    const v = cleanLine(labeled);
    if (looksLikeCompetition(v)) return v;
  }

  return null;
}

function isPrintDateContext(text: string, dateIndex: number): boolean {
  const before = text.slice(Math.max(0, dateIndex - 48), dateIndex);
  if (/impreso\s+por[\s\S]{0,40}$/i.test(before)) return true;
  if (
    /fecha\s*:\s*$/i.test(before) &&
    !/fecha\s+y\s+hora\s*:\s*$/i.test(before) &&
    !/fecha\s+del\s+partido\s*:\s*$/i.test(before)
  ) {
    return true;
  }
  return false;
}

type InformeDateHit = { formatted: string; hasTime: boolean };

function collectInformeDates(
  window: string,
  absOffset: number,
  full: string,
): InformeDateHit[] {
  const out: InformeDateHit[] = [];
  const re =
    /(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})(?:[ \t]+(\d{1,2}[:.]\d{2}))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(window))) {
    const abs = absOffset + m.index;
    if (isPrintDateContext(full, abs)) continue;
    const formatted = formatMatchDate(m[1]);
    if (!formatted) continue;
    out.push({ formatted, hasTime: Boolean(m[2]) });
  }
  return out;
}

function pickInformeDate(hits: InformeDateHit[]): string | null {
  const timed = hits.find((h) => h.hasTime);
  if (timed) return timed.formatted;
  return hits[0]?.formatted || null;
}

export function extractMatchDateFromInforme(text: string): string | null {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  if (!normalized.trim()) return null;

  const labelRe = /Fecha\s+y\s+hora|Fecha\s+del\s+partido/i;
  const labelIdx = normalized.search(labelRe);
  if (labelIdx >= 0) {
    const window = normalized.slice(labelIdx, labelIdx + 900);
    const picked = pickInformeDate(
      collectInformeDates(window, labelIdx, normalized),
    );
    if (picked) return picked;
  }

  const idx = normalized.search(/informe\s+del\s+partido/i);
  if (idx >= 0) {
    const slice = normalized.slice(idx, idx + 1800);
    const timedOnly = collectInformeDates(slice, idx, normalized).filter(
      (h) => h.hasTime,
    );
    if (timedOnly[0]) return timedOnly[0].formatted;
  }
  return null;
}

export function extractTipoEventoRaw(text: string): string | null {
  const normalized = String(text || "").replace(/\u0000/g, " ");
  if (normalized.trim().length < 20) return null;

  // “Descripción de infracción” completo — no solo “Descripción” + “:”
  // (en texto pegado: “…Violenta Descripción de infracción: …”).
  const stopLabel =
    "Club|Competici[oó]n|Equipo|Local|Visitante|Fecha|Hora|Impreso|Descripci[oó]n(?:\\s+de(?:\\s+la)?\\s+infracci[oó]n)?|Motivo|N[uú]m|N[uú]mero|Decisi[oó]n|Partido|Categor[ií]a|Divisi[oó]n|Infractor|Entrenador|Oficial|Expulsado|Alineaciones|Tipo\\s+de\\s+infractor";

  const looksLikeEventoValue = (raw: string): boolean => {
    const v = cleanLine(raw.replace(/[|•].*$/, ""));
    if (!v || v.length < 3 || v.length > 280) return false;
    if (/^tipo(\s+de\s+evento)?$/i.test(v)) return false;
    if (TABLE_LABEL_ONLY_RE.test(v)) return false;
    if (
      /^(club|partido|competici|descripci|infractor|fecha|hora|jugador|jugadora)\b/i.test(
        v,
      )
    ) {
      return false;
    }
    if (ROLE_VALUE_RE.test(v)) return false;
    if (looksLikeCometPersonCell(v)) return false;
    // Prefijos COMET típicos del primer select.
    if (
      /^(tarjeta\s+(roja|amarilla)|expulsi[oó]n|amonestaci[oó]n)\b/i.test(v)
    ) {
      return true;
    }
    // Causal suelto (segunda línea).
    if (
      /conducta|juego\s+brusco|malograr|retardar|lenguaje|infracci|antideportiv|banco|oportunidad|violencia|ofensiv|obscen/i.test(
        v,
      )
    ) {
      return true;
    }
    return false;
  };

  const stripTrailingDesc = (raw: string): string =>
    cleanLine(
      raw
        .replace(
          /\s+Descripci[oó]n(?:\s+de(?:\s+la)?\s+infracci[oó]n)?\s*[:\-].*$/i,
          "",
        )
        .replace(/[|•].*$/, ""),
    );

  const joinTipoCausal = (parts: string[]): string | null => {
    if (parts.length === 0) return null;
    if (parts.length === 1) return stripTrailingDesc(parts[0]!);
    const a = parts[0]!;
    const b = parts[1]!;
    if (/\s-\s/.test(a)) return stripTrailingDesc(a);
    return stripTrailingDesc(`${a} - ${b}`);
  };

  // 1) Misma línea / texto corrido.
  const inline = normalized.match(
    new RegExp(
      `Tipo\\s+de\\s+evento\\s*[:\\-]?\\s*([^\\n]{3,320}?)(?=\\s+(?:${stopLabel})\\s*[:\\-]|\\n|$)`,
      "i",
    ),
  );
  let value = inline?.[1] ? stripTrailingDesc(inline[1]) : "";
  if (value && !looksLikeEventoValue(value)) value = "";

  const onlyTipo =
    value &&
    /^(tarjeta\s+(roja|amarilla)|expulsi[oó]n|amonestaci[oó]n)\b/i.test(value) &&
    !/\s-\s/.test(value);

  // 2) Líneas siguientes al label (interleaved o columnas apiladas).
  if (!value || value.length < 8 || onlyTipo) {
    const labelRe = /Tipo\s+de\s+evento\s*[:\-]?/gi;
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = labelRe.exec(normalized))) {
      const rest = normalized.slice(labelMatch.index + labelMatch[0].length);
      const lines = rest
        .split(/\r?\n/)
        .map((l) => cleanLine(l))
        .filter(Boolean)
        .slice(0, 24);
      const parts: string[] = [];
      for (const line of lines) {
        // Labels apilados (Jasper): saltear, no cortar — los valores vienen después.
        if (TABLE_LABEL_ONLY_RE.test(line)) continue;
        if (
          /^(Descripci[oó]n(?:\s+de(?:\s+la)?\s+infracci[oó]n)?|Motivo)\s*[:\-]?$/i.test(
            line,
          )
        ) {
          continue;
        }
        // Valor de descripción ya empezó: si aún no hay evento, seguir buscando;
        // si ya juntamos tipo+causal, listo.
        if (
          /^Descripci[oó]n(?:\s+de(?:\s+la)?\s+infracci[oó]n)?\s*[:\-]/i.test(line)
        ) {
          if (parts.length) break;
          continue;
        }
        if (!looksLikeEventoValue(line)) {
          if (parts.length > 0) break;
          continue;
        }
        parts.push(stripTrailingDesc(line));
        if (parts.length === 1 && /\s-\s/.test(parts[0]!)) break;
        if (parts.length >= 2) break;
      }
      const joined = joinTipoCausal(parts);
      if (joined && looksLikeEventoValue(joined)) {
        value = joined;
        break;
      }
    }
  }

  // 3) Fallback global: línea con “Tarjeta/Expulsión - causal” cerca del label.
  if (!value || !looksLikeEventoValue(value)) {
    const labelIdx = normalized.search(/Tipo\s+de\s+evento/i);
    const window =
      labelIdx >= 0
        ? normalized.slice(Math.max(0, labelIdx), labelIdx + 2500)
        : normalized.slice(0, 4000);
    const global = window.match(
      /((?:Tarjeta\s+(?:roja|amarilla)|Expulsi[oó]n)\s*-\s*[^\n]{3,200})/i,
    );
    if (global?.[1]) {
      const cleaned = stripTrailingDesc(global[1]);
      if (looksLikeEventoValue(cleaned)) value = cleaned;
    }
  }

  if (!value || value.length < 3) return null;
  if (!looksLikeEventoValue(value)) return null;
  return value.slice(0, 280);
}

/**
 * Extrae hechos tipados de PDFs COMET (caso disciplinario / informe).
 */
export function extractCometFacts(
  text: string,
  hints?: { matchFolder?: string; fileName?: string },
): CometFacts {
  void hints?.fileName;
  const normalized = String(text || "").replace(/\u0000/g, " ");
  if (normalized.trim().length < 20) {
    return {
      person: null,
      club: null,
      role: null,
      offenseSummary: null,
      tipoEvento: null,
      matchDate: null,
      homeClub: null,
      awayClub: null,
      competition: null,
      extractedPersons: [],
      signals: [],
      confidence: 0,
    };
  }

  const roleRaw =
    extractTipoInfractorRaw(normalized) ||
    fieldValue(normalized, [
      /tipo\s+de\s+infractor/i,
      /infractor\s+tipo/i,
      /offender\s+type/i,
    ]);

  const person = pickPrimaryPerson(normalized);
  const extractedPersons = extractPersonCandidates(normalized);

  const clubRaw =
    extractClubDelInfractorRaw(normalized) ||
    fieldValue(normalized, [
      /club\s+del\s+infractor/i,
      /equipo\s+del\s+infractor/i,
    ]) ||
    normalized.match(
      /(?:^|\n)\s*Club\s*:\s*([^\n]{2,80}?)(?=\s+(?:Competici|Disciplina|Partido|Local|Fecha|Hora|Tipo|Infractor)|$)/im,
    )?.[1] ||
    null;

  const competition = extractCompeticionRaw(normalized);

  const offenseRaw =
    fieldValue(normalized, [
      /descripci[oó]n\s+de\s+la?\s*infracci[oó]n/i,
      /descripci[oó]n\s+de\s+infracci[oó]n/i,
      /motivo\s+de\s+la\s+expulsi[oó]n/i,
    ]) || null;

  const offense =
    offenseRaw && !isJunkField(offenseRaw)
      ? cleanLine(offenseRaw).slice(0, 280)
      : null;

  const tipoEvento = extractTipoEventoRaw(normalized);

  const isInforme = /informe\s+del\s+partido/i.test(normalized);
  const matchDate = isInforme
    ? extractMatchDateFromInforme(normalized)
    : formatMatchDate(
        fieldValue(normalized, [
          /fecha\s+y\s+hora/i,
          /fecha\s+del\s+partido/i,
          /match\s+date/i,
        ]) ||
          normalized.match(
            /Fecha\s+y\s+hora\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
          )?.[1] ||
          normalized.match(
            /Fecha\s+del\s+partido\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
          )?.[1] ||
          null,
      ) || null;

  const clubs = parseMatchClubs(normalized, hints?.matchFolder);
  const club = preferClubNameFromPartido(
    clubRaw,
    clubs.homeClub,
    clubs.awayClub,
  );
  const signals = collectSignals(normalized);
  const role =
    roleFromSnippet(roleRaw) ||
    (signals.includes("entrenador_expulsado")
      ? "entrenador"
      : signals.includes("doble_amonestacion")
        ? "jugador"
        : null);

  const persons =
    extractedPersons.length > 0
      ? extractedPersons
      : person
        ? [person]
        : [];

  let confidence = 20;
  if (person || persons.length) confidence += 30;
  if (club || clubs.homeClub) confidence += 20;
  if (competition) confidence += 10;
  if (offense) confidence += 10;
  if (tipoEvento) confidence += 5;
  if (role) confidence += 10;
  if (signals.length) confidence += 5;

  return {
    person: person || persons[0] || null,
    club,
    role,
    offenseSummary: offense,
    tipoEvento,
    matchDate,
    homeClub: clubs.homeClub,
    awayClub: clubs.awayClub,
    competition,
    extractedPersons: persons,
    signals,
    confidence: Math.min(95, confidence),
  };
}
