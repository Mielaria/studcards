// Preferencia por materia: ¿todas las preguntas se responden por micrófono?
// Se guarda solo en el navegador (localStorage); NO toca Supabase.

import { useCallback, useEffect, useState } from "react";

const KEY = (subjectId: string) => `studcards:audio-only:${subjectId}`;

export function readAudioOnly(subjectId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY(subjectId)) === "1";
  } catch {
    return false;
  }
}

export function writeAudioOnly(subjectId: string, enabled: boolean) {
  try {
    window.localStorage.setItem(KEY(subjectId), enabled ? "1" : "0");
  } catch {
    /* almacenamiento no disponible */
  }
}

export function useAudioOnly(subjectId: string) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readAudioOnly(subjectId));
  }, [subjectId]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      writeAudioOnly(subjectId, next);
      return next;
    });
  }, [subjectId]);

  return { enabled, toggle };
}
