import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dayKey, msUntilNextMidnight, serverNow, syncClock } from "@/lib/clock";

/**
 * Devuelve la clave del día oficial (America/Bogota) y dispara exactamente a
 * las 00:00:00 una invalidación de las queries de contadores y colas, para que
 * el nuevo ciclo diario aparezca sin recargar ni cerrar sesión.
 */
export function useOfficialDay(): string {
  const qc = useQueryClient();
  const [key, setKey] = useState(() => dayKey(serverNow()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const refresh = () => {
      const next = dayKey(serverNow());
      setKey((prev) => {
        if (prev !== next) {
          qc.invalidateQueries();
        }
        return next;
      });
    };

    const schedule = () => {
      const delay = Math.max(1000, msUntilNextMidnight() + 500);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, delay);
    };

    void syncClock().then(refresh);
    schedule();

    const onFocus = () => {
      void syncClock(true).then(refresh);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [qc]);

  return key;
}
