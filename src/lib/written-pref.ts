// Preferencia por materia: ¿se permiten preguntas de respuesta escrita?
// Se guarda solo en el navegador (localStorage); NO toca Supabase.

import { useCallback, useEffect, useState } from "react";

const KEY = (subjectId: string) => `studcards:written:${subjectId}`;

export function readWrittenEnabled(subjectId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(KEY(subjectId));
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function writeWrittenEnabled(subjectId: string, enabled: boolean) {
  try {
    window.localStorage.setItem(KEY(subjectId), enabled ? "1" : "0");
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Estado de la preferencia con lectura segura tras hidratación. */
export function useWrittenEnabled(subjectId: string) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(readWrittenEnabled(subjectId));
  }, [subjectId]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      writeWrittenEnabled(subjectId, next);
      return next;
    });
  }, [subjectId]);

  return { enabled, toggle };
}
