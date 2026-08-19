import { dayKey, serverNow, startOfDay } from "@/lib/clock";

/**
 * Calcula la racha de días consecutivos con al menos una sesión de estudio
 * terminada, según el día oficial (America/Bogota).
 */
export function computeStreak(
  completedDates: (string | Date)[],
  now: Date = serverNow(),
): number {
  const days = new Set(
    completedDates
      .map((d) => (typeof d === "string" ? new Date(d) : d))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map((d) => dayKey(d)),
  );
  if (days.size === 0) return 0;

  const today = dayKey(now);
  let cursor = startOfDay(now);
  // Si hoy aún no hay sesión, la racha puede seguir viva desde ayer.
  if (!days.has(today)) {
    cursor = startOfDay(new Date(cursor.getTime() - 12 * 60 * 60 * 1000));
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = startOfDay(new Date(cursor.getTime() - 12 * 60 * 60 * 1000));
  }
  return streak;
}
