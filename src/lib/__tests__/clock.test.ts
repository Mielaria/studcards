import { describe, expect, it, beforeEach } from "vitest";
import {
  dayKey,
  endOfDay,
  msUntilNextMidnight,
  serverNow,
  setClockOffsetMs,
  startOfDay,
  startOfNextDay,
} from "@/lib/clock";

const MON_10 = new Date("2026-08-17T15:00:00.000Z"); // lunes 10:00 Bogotá
const MON_2359 = new Date("2026-08-18T04:59:59.000Z"); // lunes 23:59:59 Bogotá
const TUE_0000 = new Date("2026-08-18T05:00:00.000Z"); // martes 00:00:00 Bogotá
const TUE_0001 = new Date("2026-08-18T05:01:00.000Z"); // martes 00:01 Bogotá

describe("reloj oficial (America/Bogota)", () => {
  beforeEach(() => setClockOffsetMs(0));

  it("el día cambia exactamente a las 00:00:00", () => {
    expect(dayKey(MON_10)).toBe("2026-08-17");
    expect(dayKey(MON_2359)).toBe("2026-08-17");
    expect(dayKey(TUE_0000)).toBe("2026-08-18");
    expect(dayKey(TUE_0001)).toBe("2026-08-18");
  });

  it("startOfDay / endOfDay delimitan el día oficial", () => {
    expect(startOfDay(MON_10).toISOString()).toBe("2026-08-17T05:00:00.000Z");
    expect(startOfNextDay(MON_10).toISOString()).toBe("2026-08-18T05:00:00.000Z");
    expect(endOfDay(MON_10).toISOString()).toBe("2026-08-18T04:59:59.999Z");
  });

  it("pasar unas horas del lunes no adelanta dos días", () => {
    expect(dayKey(MON_10)).toBe(dayKey(new Date(MON_10.getTime() + 8 * 3600_000)));
  });

  it("msUntilNextMidnight apunta a las 00:00 siguientes", () => {
    expect(msUntilNextMidnight(MON_2359)).toBe(1000);
  });

  it("serverNow usa el desfase del servidor, no solo el reloj local", () => {
    const local = Date.now();
    setClockOffsetMs(3_600_000);
    expect(serverNow().getTime() - local).toBeGreaterThan(3_500_000);
  });
});
