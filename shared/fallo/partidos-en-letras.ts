/**
 * Cantidades en letras (es-AR) para partidos de suspensión.
 * Port de tribunal-app `lib/partidos-en-letras.ts`.
 */

const ONES = [
  "",
  "un",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
] as const;

const TEENS = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
] as const;

const TENS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
] as const;

const TWENTIES: Record<number, string> = {
  1: "veintiún",
  2: "veintidós",
  3: "veintitrés",
  4: "veinticuatro",
  5: "veinticinco",
  6: "veintiséis",
  7: "veintisiete",
  8: "veintiocho",
  9: "veintinueve",
};

function underHundred(n: number): string {
  if (n <= 0) return "cero";
  if (n < 10) return ONES[n]!;
  if (n < 20) return TEENS[n - 10]!;
  if (n === 20) return "veinte";
  if (n < 30) return TWENTIES[n - 20] || `veinti${ONES[n - 20]}`;
  const ten = Math.floor(n / 10);
  const one = n % 10;
  if (one === 0) return TENS[ten]!;
  if (one === 1) return `${TENS[ten]} y un`;
  return `${TENS[ten]} y ${ONES[one]}`;
}

export function integerToSpanishWords(value: number): string {
  const n = Math.max(0, Math.round(Number(value) || 0));
  if (n === 0) return "cero";
  if (n < 100) return underHundred(n);
  if (n === 100) return "cien";
  if (n < 200) return `ciento ${underHundred(n - 100)}`;
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const hundredWord =
      hundreds === 5
        ? "quinientos"
        : hundreds === 7
          ? "setecientos"
          : hundreds === 9
            ? "novecientos"
            : `${ONES[hundreds]}cientos`;
    return rest === 0 ? hundredWord : `${hundredWord} ${underHundred(rest)}`;
  }
  return String(n);
}

/** "un partido" / "tres partidos" / "veintiún partidos". */
export function partidosLabel(n: number): string {
  const num = Math.max(1, Math.round(Number(n) || 1));
  const words = integerToSpanishWords(num);
  return num === 1 ? `${words} partido` : `${words} partidos`;
}

export function ensurePartidosEnLetras(text: string): string {
  return String(text || "").replace(
    /\bpor\s+(\d+)\s+partidos?\b/gi,
    (_full, digits: string) => `por ${partidosLabel(Number(digits))}`,
  );
}
