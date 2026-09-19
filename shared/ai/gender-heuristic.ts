/**
 * Heurística local de género en roles (sin Gemini).
 * Usada cuando no hay API key o como refuerzo ligero.
 */

const FEMALE_NAME_HINT =
  /\b(maria|maría|ana|lucia|lucía|camila|sofia|sofía|valentina|florencia|carolina|julieta|agustina|martina|victoria|paula|romina|celeste|milagros|daiana|dayana|brenda|melina|yamila|jazmin|jazmín|lourdes|macarena|ayelen|ayelén|gianella|bianchini)\b/i;

const MALE_NAME_HINT =
  /\b(juan|jose|josé|carlos|luis|miguel|diego|martin|martín|pedro|pablo|andres|andrés|fernando|ricardo|sebastian|sebastián|nicolas|nicolás|gabriel|matias|matías|facundo|tomas|tomás|ignacio|alejandro|lucas|franco)\b/i;

const ROLE_PAIRS: Array<[RegExp, string, string]> = [
  [/^jugadora?$/i, "Jugador", "Jugadora"],
  [/^entrenadora?$/i, "Entrenador", "Entrenadora"],
  [/^asistente$/i, "Asistente", "Asistente"],
  [/^dirigente$/i, "Dirigente", "Dirigente"],
  [/^cuerpo\s+t[eé]cnico$/i, "Cuerpo técnico", "Cuerpo técnico"],
  [/^m[eé]dic[oa]$/i, "Médico", "Médica"],
  [/^utilero$/i, "Utilero", "Utilera"],
  [/^utilera$/i, "Utilero", "Utilera"],
  [/^arquero$/i, "Arquero", "Arquera"],
  [/^arquera$/i, "Arquero", "Arquera"],
];

function guessFemale(person: string | null | undefined): boolean | null {
  const name = (person ?? "").trim();
  if (!name) return null;
  if (FEMALE_NAME_HINT.test(name)) return true;
  if (MALE_NAME_HINT.test(name)) return false;
  // Heurística española: nombres terminados en -a suelen ser femeninos
  const first = name.split(/\s+/)[0] ?? "";
  if (/a$/i.test(first) && !/^(matias|matías|tomas|tomás|lucas|nicolas|nicolás)$/i.test(first)) {
    return true;
  }
  return null;
}

export type GenderHeuristicResult = {
  role: string | null;
  changed: boolean;
  note?: string;
};

/**
 * Ajusta rol jugador/jugadora (y pares similares) según el nombre.
 */
export function applyGenderHeuristic(
  person: string | null | undefined,
  role: string | null | undefined,
): GenderHeuristicResult {
  const current = (role ?? "").trim();
  if (!current) {
    return { role: role ?? null, changed: false };
  }

  const female = guessFemale(person);
  if (female == null) {
    return { role: current, changed: false };
  }

  for (const [re, maleForm, femaleForm] of ROLE_PAIRS) {
    if (!re.test(current)) continue;
    const target = female ? femaleForm : maleForm;
    if (current.toLowerCase() === target.toLowerCase()) {
      return { role: current, changed: false };
    }
    // Solo cambiar si es el par masculino/femenino del mismo rol
    if (
      current.toLowerCase() === maleForm.toLowerCase() ||
      current.toLowerCase() === femaleForm.toLowerCase()
    ) {
      return {
        role: target,
        changed: true,
        note: `rol: "${current}" → "${target}" (género, heurística local)`,
      };
    }
  }

  return { role: current, changed: false };
}
