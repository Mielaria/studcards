// Tamaño de fuente de la sesión de estudio (preferencia local del dispositivo).
export type FontSize = "sm" | "md" | "lg";

const KEY = "study-font-size";

export function getFontSize(): FontSize {
  if (typeof localStorage === "undefined") return "md";
  const v = localStorage.getItem(KEY);
  return v === "sm" || v === "lg" ? v : "md";
}

export function setFontSize(size: FontSize) {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Clases de tamaño por elemento según la preferencia. */
export const FONT_CLASSES: Record<
  FontSize,
  { question: string; body: string; small: string }
> = {
  sm: { question: "text-sm md:text-base", body: "text-xs", small: "text-[0.65rem]" },
  md: { question: "text-xl md:text-2xl", body: "text-sm", small: "text-xs" },
  lg: { question: "text-2xl md:text-3xl", body: "text-base", small: "text-sm" },
};

/** Escala aplicada a TODO el contenido de la sesión (cronómetro, opciones, precisión…). */
export const FONT_SCALE: Record<FontSize, number> = {
  sm: 0.78,
  md: 1,
  lg: 1.12,
};
