// Spaced-repetition core logic. Stage → interval on correct:
// 1 (Día 1) → 2d → 2 (2 días) → 5d → 3 (5 días) → 10d → 4 (10 días) → 30d → 5 (1 mes) → Learned
// Any wrong answer resets to Stage 1, next review tomorrow.
// Wrong on a learned card returns it to its subject at Stage 1, keeps historical counter.

import { serverNow, startOfDay, startOfNextDay } from "@/lib/clock";

export type Stage = 1 | 2 | 3 | 4 | 5;

export const STAGE_LABELS: Record<Stage, string> = {
  1: "Día 1",
  2: "2 días",
  3: "5 días",
  4: "10 días",
  5: "1 mes",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Suma días y ancla el resultado a las 00:00:00 del día oficial resultante,
 * para que las cartas queden disponibles desde el inicio de ese día.
 */
export function addDays(base: Date, days: number): Date {
  if (days <= 1) return startOfNextDay(base);
  return startOfDay(new Date(base.getTime() + days * DAY_MS));
}

export interface SrsUpdate {
  new_stage: Stage;
  next_review_at: string;
  is_learned: boolean;
  correct_answers_count_delta: number;
  next_interval_label: string;
}

export function applyAnswer(params: {
  current_stage: Stage;
  is_learned: boolean;
  is_correct: boolean;
}): SrsUpdate {
  const now = serverNow();
  const { current_stage, is_learned, is_correct } = params;

  if (is_learned) {
    if (is_correct) {
      return {
        new_stage: current_stage,
        next_review_at: now.toISOString(),
        is_learned: true,
        correct_answers_count_delta: 1,
        next_interval_label: "Permanece en Aprendidas",
      };
    }
    return {
      new_stage: 1,
      next_review_at: addDays(now, 1).toISOString(),
      is_learned: false,
      correct_answers_count_delta: 0,
      next_interval_label: "Regresa a su materia (mañana)",
    };
  }

  if (!is_correct) {
    return {
      new_stage: 1,
      next_review_at: addDays(now, 1).toISOString(),
      is_learned: false,
      correct_answers_count_delta: 0,
      next_interval_label: "Mañana",
    };
  }

  switch (current_stage) {
    case 1:
      return {
        new_stage: 2,
        next_review_at: addDays(now, 2).toISOString(),
        is_learned: false,
        correct_answers_count_delta: 1,
        next_interval_label: "En 2 días",
      };
    case 2:
      return {
        new_stage: 3,
        next_review_at: addDays(now, 5).toISOString(),
        is_learned: false,
        correct_answers_count_delta: 1,
        next_interval_label: "En 5 días",
      };
    case 3:
      return {
        new_stage: 4,
        next_review_at: addDays(now, 10).toISOString(),
        is_learned: false,
        correct_answers_count_delta: 1,
        next_interval_label: "En 10 días",
      };
    case 4:
      return {
        new_stage: 5,
        next_review_at: addDays(now, 30).toISOString(),
        is_learned: false,
        correct_answers_count_delta: 1,
        next_interval_label: "En 1 mes",
      };
    case 5:
      return {
        new_stage: 5,
        next_review_at: now.toISOString(),
        is_learned: true,
        correct_answers_count_delta: 1,
        next_interval_label: "¡Aprendida!",
      };
  }
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
