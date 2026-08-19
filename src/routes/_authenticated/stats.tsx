import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BarChart3, Clock, Target, TrendingUp, Trash2 } from "lucide-react";


export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({
    meta: [
      { title: "Estadísticas — StudCards" },
      { name: "description", content: "Historial de sesiones y precisión de estudio en StudCards." },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function clearStats() {
    setClearing(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sesión no válida");
      const { error } = await supabase.from("study_sessions").delete().eq("user_id", uid);
      if (error) throw error;
      toast.success("Estadísticas limpiadas");
      setConfirming(false);
      await qc.invalidateQueries({ queryKey: ["study-sessions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron limpiar");
    } finally {
      setClearing(false);
    }
  }

  const { data: sessions } = useQuery({

    queryKey: ["study-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("id, session_type, subject_id, started_at, completed_at, duration_seconds, cards_studied, correct_count, incorrect_count, accuracy")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, name");
      return data ?? [];
    },
  });

  const nameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));

  const totals = (sessions ?? []).reduce(
    (acc, s) => {
      acc.cards += s.cards_studied ?? 0;
      acc.correct += s.correct_count ?? 0;
      acc.seconds += s.duration_seconds ?? 0;
      return acc;
    },
    { cards: 0, correct: 0, seconds: 0 },
  );
  const globalAcc = totals.cards ? Math.round((totals.correct / totals.cards) * 100) : 0;

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">Estadísticas</h1>
          <p className="text-sm text-muted-foreground">
            Tus últimas 50 sesiones registradas.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Target className="h-4 w-4" />} label="Sesiones" value={(sessions ?? []).length} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Precisión global" value={`${globalAcc}%`} />
        <StatCard label="Cartas estudiadas" value={totals.cards} icon={<BarChart3 className="h-4 w-4" />} />
        <StatCard label="Tiempo total" value={formatDuration(totals.seconds)} icon={<Clock className="h-4 w-4" />} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Historial</h2>
        {(sessions ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Aún no has completado sesiones.
          </div>
        ) : (
          <ul className="grid gap-2">
            {sessions!.map((s) => {
              const acc = s.accuracy ?? 0;
              const subjectName = s.subject_id
                ? nameById.get(s.subject_id) ?? "Materia"
                : s.session_type === "learned"
                  ? "Aprendidas"
                  : "General";
              return (
                <li
                  key={s.id}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-border bg-card p-4 text-sm shadow-card"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{subjectName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.completed_at ? new Date(s.completed_at).toLocaleString() : "—"} ·{" "}
                      {formatDuration(s.duration_seconds ?? 0)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold">{Number(acc).toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">
                      {s.correct_count}/{s.cards_studied ?? 0}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatDuration(sec: number) {
  if (!sec) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
