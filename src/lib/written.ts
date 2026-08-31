// Evaluación de respuestas escritas.
// La modalidad (opción múltiple vs respuesta escrita) se sortea en CADA
// aparición de la carta y NUNCA se guarda en Supabase. Una misma carta puede
// aparecer como opción múltiple una vez y como respuesta escrita otra.

/** Probabilidad de que una carta se presente como respuesta escrita. */
export const WRITTEN_ANSWER_PROBABILITY = 0.3;

/**
 * Normaliza texto para comparar respuestas: sin acentos, minúsculas, sin
 * signos de puntuación y con espacios colapsados.
 */
export function normalizeAnswer(value: string): string {
  return value
    .replace(/[\s\u00A0\u200B-\u200D\uFEFF]+/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Formas válidas de una respuesta: la opción correcta puede traer varias
 * alternativas separadas por "/", ";" o "|" (p. ej. "color/colour").
 */
export function correctAlternatives(correct: string): string[] {
  return correct
    .split(/[/;|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * ¿Coincide la respuesta escrita con el texto de la opción correcta?
 * Acepta cualquiera de las formas válidas de esa opción.
 */
export function answersMatch(input: string, correct: string): boolean {
  const normalized = normalizeAnswer(input);
  if (normalized.length === 0) return false;
  return correctAlternatives(correct).some(
    (alt) => normalizeAnswer(alt) === normalized,
  );
}
