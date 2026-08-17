// Reloj oficial único de la app.
// Toda la lógica de estudio (contadores, next_review_at, disponibilidad,
// cambio de día, límite diario, cola y registro de respuestas) debe usar
// serverNow() y NUNCA new Date() directamente.

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";

/** Zona horaria oficial de la aplicación. El día empieza a las 00:00:00 aquí. */
export const APP_TIME_ZONE = "America/Bogota";

let offsetMs = 0;
let lastSyncAt = 0;
let syncing: Promise<void> | null = null;

/** Desfase actual (ms) entre la hora del servidor y el reloj local. */
export function clockOffsetMs(): number {
  return offsetMs;
}

/** Permite fijar el desfase manualmente (usado en pruebas). */
export function setClockOffsetMs(ms: number) {
  offsetMs = ms;
  lastSyncAt = Date.now();
}

/** Única fuente de tiempo de la app. */
export function serverNow(): Date {
  return new Date(Date.now() + offsetMs);
}

/**
 * Sincroniza con la hora del servidor leyendo la cabecera `Date` de una
 * petición a Supabase. Se corrige por la mitad del round-trip.
 */
export async function syncClock(force = false): Promise<void> {
  if (typeof fetch === "undefined") return;
  if (!force && Date.now() - lastSyncAt < 5 * 60 * 1000) return;
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const t0 = Date.now();
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        method: "GET",
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
        cache: "no-store",
      });
      const t1 = Date.now();
      const header = res.headers.get("date");
      if (!header) return;
      const serverMs = new Date(header).getTime();
      if (Number.isNaN(serverMs)) return;
      const localMid = t0 + (t1 - t0) / 2;
      offsetMs = serverMs - localMid;
      lastSyncAt = Date.now();
    } catch {
      // Sin red: se mantiene el último desfase conocido.
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

function zoneOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** Partes de fecha en la zona oficial. */
export function zoneParts(date: Date = serverNow()) {
  const shifted = new Date(date.getTime() + zoneOffsetMs(date));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** Instante exacto de las 00:00:00 (zona oficial) del día de `date`. */
export function startOfDay(date: Date = serverNow()): Date {
  const { year, month, day } = zoneParts(date);
  const guess = new Date(Date.UTC(year, month - 1, day));
  return new Date(guess.getTime() - zoneOffsetMs(guess));
}

/** Instante de las 00:00:00 del día siguiente. */
export function startOfNextDay(date: Date = serverNow()): Date {
  const { year, month, day } = zoneParts(date);
  const guess = new Date(Date.UTC(year, month - 1, day + 1));
  return new Date(guess.getTime() - zoneOffsetMs(guess));
}

/** Último instante del día (23:59:59.999). */
export function endOfDay(date: Date = serverNow()): Date {
  return new Date(startOfNextDay(date).getTime() - 1);
}

/** Clave estable del día, p. ej. "2026-08-17". */
export function dayKey(date: Date = serverNow()): string {
  const { year, month, day } = zoneParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Milisegundos que faltan para las 00:00:00 del próximo día. */
export function msUntilNextMidnight(date: Date = serverNow()): number {
  return startOfNextDay(date).getTime() - date.getTime();
}

/** ¿Está vencida (disponible) una carta según el reloj oficial? */
export function isDue(nextReviewAt: string | Date, now: Date = serverNow()): boolean {
  const t = typeof nextReviewAt === "string" ? new Date(nextReviewAt).getTime() : nextReviewAt.getTime();
  return t <= now.getTime();
}
