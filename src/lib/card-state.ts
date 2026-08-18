// Clasificación de estados de carta. La distinción Nueva / Fallada NO usa
// learning_stage ni correct_answers_count: se deriva de card_review_history.

import { supabase } from "@/integrations/supabase/client";
import { isDue, serverNow } from "@/lib/clock";

export type CardState = "new" | "failed" | "learning" | "learned";

export interface LastAnswer {
  is_correct: boolean;
  answered_at: string;
}

export interface StatefulCard {
  id: string;
  is_learned: boolean;
  next_review_at: string;
}

/** Estado según las definiciones exactas del sistema. */
export function classifyCard(
  card: { is_learned: boolean },
  last: LastAnswer | undefined,
): CardState {
  if (card.is_learned) return "learned";
  if (!last) return "new";
  return last.is_correct ? "learning" : "failed";
}

/** Última respuesta (por answered_at) de cada carta indicada. */
export async function fetchLastAnswers(
  cardIds: string[],
): Promise<Map<string, LastAnswer>> {
  const map = new Map<string, LastAnswer>();
  if (cardIds.length === 0) return map;
  const CHUNK = 200;
  for (let i = 0; i < cardIds.length; i += CHUNK) {
    const chunk = cardIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("card_review_history")
      .select("flashcard_id, is_correct, answered_at")
      .in("flashcard_id", chunk)
      .order("answered_at", { ascending: false });
    if (error) throw error;
    for (const row of data ?? []) {
      const prev = map.get(row.flashcard_id);
      if (!prev || new Date(row.answered_at) > new Date(prev.answered_at)) {
        map.set(row.flashcard_id, {
          is_correct: row.is_correct,
          answered_at: row.answered_at,
        });
      }
    }
  }
  return map;
}

export interface StateCounts {
  total: number;
  new: number;
  failed: number;
  learning: number;
  learned: number;
  due: number;
}

/**
 * Contadores por estado. "failed" cuenta TODAS las cartas cuya última
 * respuesta fue incorrecta (estén vencidas o no); "due" cuenta solo las
 * disponibles hoy según el reloj oficial.
 */
export function countByState(
  cards: StatefulCard[],
  lastAnswers: Map<string, LastAnswer>,
  now: Date = serverNow(),
): StateCounts {
  const counts: StateCounts = { total: cards.length, new: 0, failed: 0, learning: 0, learned: 0, due: 0 };
  for (const card of cards) {
    const state = classifyCard(card, lastAnswers.get(card.id));
    const due = isDue(card.next_review_at, now);
    if (state === "learned") counts.learned++;
    else if (state === "new") counts.new++;
    else if (state === "failed") {
      if (due) counts.failed++;
    } else counts.learning++;
    if (state !== "learned" && due) counts.due++;
  }
  return counts;
}
