/**
 * Roles + género gramatical (al / a la).
 * Subconjunto de tribunal-app `lib/manual-roles.ts`.
 */

export type RoleGender = "m" | "f";

const FEMININE_EXACT = new Set([
  "jugadora",
  "directora técnica",
  "preparadora física",
  "kinesióloga",
  "delegada",
  "aguatera",
  "utilera",
]);

const MASCULINE_EXACT = new Set([
  "jugador",
  "director técnico",
  "preparador físico",
  "kinesiólogo",
  "delegado",
  "aguatero",
  "utilero",
  "personal auxiliar",
  "menor alcanza balones",
  "club",
]);

function normRole(role: string | null | undefined): string {
  return String(role || "")
    .trim()
    .toLocaleLowerCase("es-AR")
    .replace(/\s+/g, " ");
}

export function roleGender(role: string | null | undefined): RoleGender {
  const n = normRole(role);
  if (!n || n === "club") return "m";
  if (FEMININE_EXACT.has(n)) return "f";
  if (MASCULINE_EXACT.has(n)) return "m";
  if (
    /(?:jugadora|directora|t[eé]cnica|delegada|aguatera|utilera|kinesi[oó]loga|m[eé]dica|entrenadora)$/i.test(
      n,
    )
  ) {
    return "f";
  }
  if (/(?:a|ora|era|ada|adora)$/i.test(n)) {
    if (/\bf[ií]sico\b|\bbalones\b|\bt[eé]cnico\b/.test(n)) return "m";
    return "f";
  }
  return "m";
}

/** "al jugador" / "a la jugadora" */
export function roleAl(role: string): string {
  const r = String(role || "jugador").trim() || "jugador";
  return roleGender(r) === "f" ? `a la ${r}` : `al ${r}`;
}

export function normalizarCargo(cargo: string): string {
  const raw = cargo.trim().toLowerCase();
  if (raw.includes("entrenador asistente")) return "director técnico";
  if (raw.includes("delegado de campo")) return "delegado";
  return cargo.trim();
}
