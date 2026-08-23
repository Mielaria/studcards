import { describe, expect, it } from "vitest";
import { answersMatch, normalizeAnswer, WRITTEN_ANSWER_PROBABILITY } from "@/lib/written";

describe("normalizeAnswer", () => {
  it("ignora mayúsculas y minúsculas", () => {
    expect(normalizeAnswer("Apple")).toBe(normalizeAnswer("apple"));
  });

  it("ignora acentos", () => {
    expect(normalizeAnswer("inglés")).toBe("ingles");
  });

  it("elimina signos de puntuación", () => {
    expect(normalizeAnswer("don't")).toBe("dont");
    expect(normalizeAnswer("¿Qué?")).toBe("que");
  });

  it("colapsa espacios y recorta extremos", () => {
    expect(normalizeAnswer("  the   cat  ")).toBe("the cat");
  });
});

describe("answersMatch", () => {
  it("acepta respuesta exacta con diferencias de formato", () => {
    expect(answersMatch("  APPLE ", "apple")).toBe(true);
    expect(answersMatch("Don't", "don't")).toBe(true);
  });

  it("rechaza respuestas distintas", () => {
    expect(answersMatch("apples", "apple")).toBe(false);
    expect(answersMatch("orange", "apple")).toBe(false);
  });

  it("rechaza respuesta vacía", () => {
    expect(answersMatch("   ", "apple")).toBe(false);
  });

  it("acepta formas alternativas separadas por /, ; o |", () => {
    expect(answersMatch("colour", "color/colour")).toBe(true);
    expect(answersMatch("color", "color/colour")).toBe(true);
    expect(answersMatch("grey", "gray; grey")).toBe(true);
    expect(answersMatch("gris", "gray; grey")).toBe(false);
  });
});

describe("sorteo de modalidad", () => {
  it("la probabilidad de respuesta escrita es 30%", () => {
    expect(WRITTEN_ANSWER_PROBABILITY).toBe(0.3);
  });
});
