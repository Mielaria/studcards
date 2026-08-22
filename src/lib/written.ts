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
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** ¿Coincide la respuesta escrita con el texto de la opción correcta? */
export function answersMatch(input: string, correct: string): boolean {
  const normalized = normalizeAnswer(input);
  return normalized.length > 0 && normalized === normalizeAnswer(correct);
}
