// Descarga el contenido completo de cartas por ID, en lotes.
// Se usa después de elegir la cola de estudio para NO descargar el contenido
// (pregunta, opciones, explicación, imagen) de miles de cartas: solo se trae
// el contenido de las cartas que realmente entran en la sesión.

import { supabase } from "@/integrations/supabase/client";

const CHUNK = 200;

export async function fetchCardsByIds<T extends { id: string }>(
  select: string,
  ids: string[],
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("flashcards")
      .select(select)
      .in("id", ids.slice(i, i + CHUNK));
    if (error) throw error;
    out.push(...((data ?? []) as unknown as T[]));
  }
  return out;
}
