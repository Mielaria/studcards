// Construcción de la cola diaria con prioridad:
// 1) falladas vencidas → 2) repasos de aprendizaje vencidos → 3) nuevas.
// En la cola diaria, las cartas cuyo next_review_at aún no llegó no aparecen.
// El repaso manual de falladas sí incluye todas las falladas inmediatamente.

import { classifyCard, type CardState, type LastAnswer } from "@/lib/card-state";
import { isDue, serverNow } from "@/lib/clock";
import { shuffle } from "@/lib/srs";

export interface QueueCard {
  id: string;
  is_learned: boolean;
  next_review_at: string;
  [key: string]: unknown;
}

export interface QueueBreakdown {
  failed: number;
  learning: number;
  new: number;
}

export interface BuildQueueResult<T extends QueueCard> {
  queue: T[];
  breakdown: QueueBreakdown;
  available: QueueBreakdown;
}

export function buildDailyQueue<T extends QueueCard>(params: {
  cards: T[];
  lastAnswers: Map<string, LastAnswer>;
  now?: Date;
  limit: number | "all";
  /** Restringe la cola a un único estado (p. ej. "failed"). */
  only?: CardState;
  /** Desactiva el barajado (pruebas deterministas). */
  shuffleGroups?: boolean;
}): BuildQueueResult<T> {
  const { cards, lastAnswers, only } = params;
  const now = params.now ?? serverNow();
  const doShuffle = params.shuffleGroups ?? true;

  const groups: Record<"failed" | "learning" | "new", T[]> = {
    failed: [],
    learning: [],
    new: [],
  };

  for (const card of cards) {
    const state = classifyCard(card, lastAnswers.get(card.id));
    if (state === "learned") continue;
    if (only && state !== only) continue;
    const isManualFailedReview = only === "failed" && state === "failed";
    if (!isManualFailedReview && !isDue(card.next_review_at, now)) continue;
    groups[state].push(card);
  }

  const ordered = (["failed", "learning", "new"] as const).map((k) =>
    doShuffle ? shuffle(groups[k]) : groups[k].slice(),
  );

  const available: QueueBreakdown = {
    failed: groups.failed.length,
    learning: groups.learning.length,
    new: groups.new.length,
  };

  const totalAvailable = available.failed + available.learning + available.new;
  const limit = params.limit === "all" ? totalAvailable : Math.max(0, params.limit);

  const queue: T[] = [];
  const breakdown: QueueBreakdown = { failed: 0, learning: 0, new: 0 };
  const keys = ["failed", "learning", "new"] as const;

  keys.forEach((key, i) => {
    for (const card of ordered[i]) {
      if (queue.length >= limit) return;
      queue.push(card);
      breakdown[key]++;
    }
  });

  return { queue, breakdown, available };
}
