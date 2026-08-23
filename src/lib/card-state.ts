// Clasificación de estados de carta. La distinción Nueva / Fallada NO usa
// learning_stage ni correct_answers_count: se deriva de card_review_history.
//
// Rendimiento: fetchLastAnswers y fetchStateCounts intentan usar las RPCs
// get_last_answers / get_card_state_counts (SQL entregado aparte al usuario).
// Si la RPC aún no existe en Supabase, hay fallback automático a la lógica
// en cliente, así que la app funciona con o sin las RPCs.
// types.ts es generado y NO se modifica: las RPCs se resuelven con un cast local.

import { supabase } from "@/integrations/supabase/client";
import { isDue, serverNow } from "@/lib/clock";
import { fetchAllRows } from "@/lib/fetch-all";

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

// ---------- Wrapper local de RPCs (types.ts no las conoce) ----------

interface RpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}
type RpcFn = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<RpcResult<unknown>>;
const rpc: RpcFn = (supabase as unknown as { rpc: RpcFn }).rpc.bind(supabase);

interface LastAnswerRow {
  flashcard_id: string;
  is_correct: boolean;
  answered_at: string;
}

/** RPC get_last_answers(card_ids uuid[]): última respuesta por carta, en servidor. */
async function fetchLastAnswersRpc(
  cardIds: string[],
): Promise<Map<string, LastAnswer>> {
  const map = new Map<string, LastAnswer>();
  const CHUNK = 500;
  for (let i = 0; i < cardIds.length; i += CHUNK) {
    const { data, error } = (await rpc("get_last_answers", {
      card_ids: cardIds.slice(i, i + CHUNK),
    })) as RpcResult<LastAnswerRow[]>;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      map.set(row.flashcard_id, {
        is_correct: row.is_correct,
        answered_at: row.answered_at,
      });
    }
  }
  return map;
}

/** Fallback: descarga el historial paginado y reduce en cliente. */
async function fetchLastAnswersFallback(
  cardIds: string[],
): Promise<Map<string, LastAnswer>> {
  const map = new Map<string, LastAnswer>();
  const CHUNK = 200;
  for (let i = 0; i < cardIds.length; i += CHUNK) {
    const chunk = cardIds.slice(i, i + CHUNK);
    const data = await fetchAllRows<{
      flashcard_id: string;
      is_correct: boolean;
      answered_at: string;
    }>((from, to) =>
      supabase
        .from("card_review_history")
        .select("flashcard_id, is_correct, answered_at")
        .in("flashcard_id", chunk)
        .order("answered_at", { ascending: false })
        .range(from, to),
    );
    for (const row of data) {
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

/** Última respuesta (por answered_at) de cada carta indicada. */
export async function fetchLastAnswers(
  cardIds: string[],
): Promise<Map<string, LastAnswer>> {
  if (cardIds.length === 0) return new Map();
  try {
    return await fetchLastAnswersRpc(cardIds);
  } catch {
    // La RPC aún no existe (o falló): mismo resultado por la vía lenta.
    return fetchLastAnswersFallback(cardIds);
  }
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
    else if (state === "failed") counts.failed++;
    else counts.learning++;
    if (state !== "learned" && due) counts.due++;
  }
  return counts;
}

interface StateCountsRow {
  total: number | string;
  new: number | string;
  failed: number | string;
  learning: number | string;
  learned: number | string;
  due: number | string;
}

function rowToCounts(row: StateCountsRow): StateCounts {
  return {
    total: Number(row.total),
    new: Number(row.new),
    failed: Number(row.failed),
    learning: Number(row.learning),
    learned: Number(row.learned),
    due: Number(row.due),
  };
}

/** Fallback: descarga metadatos ligeros + últimas respuestas y cuenta en cliente. */
async function fetchStateCountsFallback(
  subjectId: string | null,
  now: Date,
): Promise<StateCounts> {
  const cards = await fetchAllRows<StatefulCard>((from, to) => {
    let q = supabase
      .from("flashcards")
      .select("id, is_learned, next_review_at");
    if (subjectId) q = q.eq("subject_id", subjectId);
    return q.order("created_at", { ascending: false }).range(from, to);
  });
  const lastAnswers = await fetchLastAnswers(cards.map((c) => c.id));
  return countByState(cards, lastAnswers, now);
}

/**
 * Contadores por estado calculados en servidor (RPC get_card_state_counts).
 * `subjectId = null` → todas las materias del usuario.
 * Fallback automático al cálculo en cliente si la RPC no existe todavía.
 */
export async function fetchStateCounts(
  subjectId: string | null,
  now: Date = serverNow(),
): Promise<StateCounts> {
  try {
    const { data, error } = (await rpc("get_card_state_counts", {
      p_subject_id: subjectId,
      p_now: now.toISOString(),
    })) as RpcResult<StateCountsRow[] | StateCountsRow>;
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("RPC sin filas");
    return rowToCounts(row);
  } catch {
    return fetchStateCountsFallback(subjectId, now);
  }
}
