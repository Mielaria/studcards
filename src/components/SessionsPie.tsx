import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart } from "lucide-react";

type Slice = { label: string; value: number; color: string };

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, ri: number, from: number, to: number) {
  const large = to - from > 180 ? 1 : 0;
  const p1 = polar(cx, cy, r, from);
  const p2 = polar(cx, cy, r, to);
  const p3 = polar(cx, cy, ri, to);
  const p4 = polar(cx, cy, ri, from);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${ri} ${ri} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

/** Torta con el resultado acumulado de las últimas 10 sesiones de estudio. */
export function SessionsPie({ dayKeyNow }: { dayKeyNow?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["last-sessions-pie", dayKeyNow],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("correct_count, incorrect_count, cards_studied, completed_at")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      const rows = data ?? [];
      const correct = rows.reduce((a, r) => a + (r.correct_count ?? 0), 0);
      const incorrect = rows.reduce((a, r) => a + (r.incorrect_count ?? 0), 0);
      return { sessions: rows.length, correct, incorrect };
    },
  });

  const correct = data?.correct ?? 0;
  const incorrect = data?.incorrect ?? 0;
  const total = correct + incorrect;
  const slices: Slice[] = [
    { label: "Correctas", value: correct, color: "var(--color-success)" },
    { label: "Falladas", value: incorrect, color: "var(--color-destructive)" },
  ];
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  let angle = 0;

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <PieChart className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold leading-tight">
            Últimas 10 sesiones
          </h3>
          <p className="text-xs text-muted-foreground">
            {data ? `${data.sessions} ${data.sessions === 1 ? "sesión" : "sesiones"} · ${total} respuestas` : "Cargando…"}
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay sesiones terminadas. Estudia una materia para ver tus resultados aquí.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <div className="relative">
            <svg viewBox="0 0 160 160" className="h-40 w-40" role="img" aria-label={`Precisión ${accuracy}%`}>
              {slices.map((s) => {
                if (s.value <= 0) return null;
                const sweep = (s.value / total) * 360;
                const d =
                  sweep >= 359.999
                    ? `M 80 8 A 72 72 0 1 1 79.99 8 Z M 80 40 A 40 40 0 1 0 79.99 40 Z`
                    : arcPath(80, 80, 72, 44, angle, angle + sweep);
                angle += sweep;
                return <path key={s.label} d={d} fill={s.color} fillRule="evenodd" />;
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-semibold tabular-nums">{accuracy}%</span>
              <span className="text-xs text-muted-foreground">precisión</span>
            </div>
          </div>
          <ul className="w-full max-w-[220px] space-y-2">
            {slices.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {s.value.toLocaleString("es-CO")} ·{" "}
                  {total > 0 ? Math.round((s.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
