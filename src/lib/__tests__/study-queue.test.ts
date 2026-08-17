import { afterAll, describe, expect, it, vi } from "vitest";
import { buildDailyQueue } from "@/lib/study-queue";
import { classifyCard, countByState, type LastAnswer } from "@/lib/card-state";
import { applyAnswer, type Stage } from "@/lib/srs";

const MON_10 = new Date("2026-08-17T15:00:00.000Z"); // lunes 10:00 Bogotá
const TUE_00_01 = new Date("2026-08-18T05:01:00.000Z"); // martes 00:01 Bogotá

type Card = {
  id: string;
  is_learned: boolean;
  next_review_at: string;
  learning_stage: number;
  correct_answers_count: number;
};

function makeCards(n: number, prefix = "c"): Card[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    is_learned: false,
    next_review_at: MON_10.toISOString(),
    learning_stage: 1,
    correct_answers_count: 0,
  }));
}

vi.useFakeTimers();
afterAll(() => vi.useRealTimers());

function answerCard(card: Card, isCorrect: boolean, last: Map<string, LastAnswer>, at: Date) {
  vi.setSystemTime(at);
  const upd = applyAnswer({
    current_stage: card.learning_stage as Stage,
    is_learned: card.is_learned,
    is_correct: isCorrect,
  });
  card.learning_stage = upd.new_stage;
  card.is_learned = upd.is_learned;
  card.correct_answers_count += upd.correct_answers_count_delta;
  card.next_review_at = upd.next_review_at;
  last.set(card.id, { is_correct: isCorrect, answered_at: at.toISOString() });
  return card;
}

describe("cola diaria y estados", () => {
  it("10 nuevas: 7 correctas → aprendizaje, 3 incorrectas → falladas", () => {
    const cards = makeCards(10);
    const last = new Map<string, LastAnswer>();
    cards.forEach((c, i) => answerCard(c, i < 7, last, MON_10));

    const states = cards.map((c) => classifyCard(c, last.get(c.id)));
    expect(states.filter((s) => s === "learning")).toHaveLength(7);
    expect(states.filter((s) => s === "failed")).toHaveLength(3);
    expect(states.filter((s) => s === "new")).toHaveLength(0);
  });

  it("al día siguiente prioriza 3 falladas y completa con 7 nuevas (límite 10)", () => {
    const studied = makeCards(10, "s");
    const last = new Map<string, LastAnswer>();
    studied.forEach((c, i) => answerCard(c, i < 7, last, MON_10));
    const fresh = makeCards(100, "n");

    const { queue, breakdown } = buildDailyQueue({
      cards: [...fresh, ...studied],
      lastAnswers: last,
      now: TUE_00_01,
      limit: 10,
      shuffleGroups: false,
    });

    expect(breakdown).toEqual({ failed: 3, learning: 0, new: 7 });
    expect(queue).toHaveLength(10);
    expect(queue.slice(0, 3).every((c) => last.get(c.id)?.is_correct === false)).toBe(true);
  });

  it("respeta prioridad falladas → aprendizaje → nuevas (3 + 2 + 5)", () => {
    const last = new Map<string, LastAnswer>();
    const failed = makeCards(3, "f").map((c) => {
      last.set(c.id, { is_correct: false, answered_at: MON_10.toISOString() });
      return c;
    });
    const learning = makeCards(2, "l").map((c) => {
      last.set(c.id, { is_correct: true, answered_at: MON_10.toISOString() });
      return c;
    });
    const fresh = makeCards(100, "n");

    const { queue, breakdown } = buildDailyQueue({
      cards: [...fresh, ...learning, ...failed],
      lastAnswers: last,
      now: TUE_00_01,
      limit: 10,
      shuffleGroups: false,
    });

    expect(breakdown).toEqual({ failed: 3, learning: 2, new: 5 });
    expect(queue.map((c) => c.id.charAt(0)).join("")).toBe("fffllnnnnn");
  });

  it("no muestra falladas ni repasos que aún no vencen", () => {
    const last = new Map<string, LastAnswer>();
    const future = makeCards(2, "f").map((c) => {
      c.next_review_at = new Date(TUE_00_01.getTime() + 86400000).toISOString();
      last.set(c.id, { is_correct: false, answered_at: MON_10.toISOString() });
      return c;
    });
    const { queue, available } = buildDailyQueue({
      cards: future,
      lastAnswers: last,
      now: TUE_00_01,
      limit: "all",
      shuffleGroups: false,
    });
    expect(queue).toHaveLength(0);
    expect(available.failed).toBe(0);
  });

  it("una fallada que vuelve a fallar sigue en falladas y nunca vuelve a Nueva", () => {
    const [card] = makeCards(1, "x");
    const last = new Map<string, LastAnswer>();
    answerCard(card, false, last, MON_10);
    expect(classifyCard(card, last.get(card.id))).toBe("failed");

    const beforeReview = card.next_review_at;
    answerCard(card, false, last, TUE_00_01);
    expect(classifyCard(card, last.get(card.id))).toBe("failed");
    expect(classifyCard(card, last.get(card.id))).not.toBe("new");
    expect(card.next_review_at).not.toBe(beforeReview);
    // Queda disponible a las 00:00 del miércoles (día oficial siguiente).
    expect(card.next_review_at).toBe("2026-08-19T05:00:00.000Z");
  });

  it("una fallada respondida bien pasa a aprendizaje y avanza de etapa", () => {
    const [card] = makeCards(1, "y");
    const last = new Map<string, LastAnswer>();
    answerCard(card, false, last, MON_10);
    answerCard(card, true, last, TUE_00_01);
    expect(classifyCard(card, last.get(card.id))).toBe("learning");
    expect(card.learning_stage).toBe(2);
  });

  it("las nuevas no se pierden: quedan disponibles para el día siguiente", () => {
    const fresh = makeCards(100, "n");
    const last = new Map<string, LastAnswer>();
    const first = buildDailyQueue({ cards: fresh, lastAnswers: last, now: MON_10, limit: 10, shuffleGroups: false });
    first.queue.forEach((c) => answerCard(c as Card, true, last, MON_10));
    const second = buildDailyQueue({ cards: fresh, lastAnswers: last, now: TUE_00_01, limit: 10, shuffleGroups: false });
    expect(second.available.new).toBe(90);
    expect(second.breakdown.new).toBe(10);
  });

  it("los contadores solo cuentan falladas vencidas", () => {
    const last = new Map<string, LastAnswer>();
    const due = makeCards(2, "d").map((c) => {
      last.set(c.id, { is_correct: false, answered_at: MON_10.toISOString() });
      return c;
    });
    const notDue = makeCards(1, "p").map((c) => {
      c.next_review_at = new Date(TUE_00_01.getTime() + 86400000).toISOString();
      last.set(c.id, { is_correct: false, answered_at: MON_10.toISOString() });
      return c;
    });
    const counts = countByState([...due, ...notDue], last, TUE_00_01);
    expect(counts.failed).toBe(2);
  });
});
