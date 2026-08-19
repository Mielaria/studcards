import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BookOpen, Sparkles, Plus, Play, Flame, Target, AlertTriangle } from "lucide-react";
import { countByState, fetchLastAnswers } from "@/lib/card-state";
import { serverNow } from "@/lib/clock";
import { computeStreak } from "@/lib/streak";
import { useOfficialDay } from "@/hooks/useOfficialDay";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Inicio — StudCards" },
      { name: "description", content: "Tu resumen de estudio del día en StudCards." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const dayKeyNow = useOfficialDay();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: streak = 0 } = useQuery({
    queryKey: ["streak", dayKeyNow],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("completed_at")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return computeStreak((data ?? []).map((s) => s.completed_at as string), serverNow());
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", dayKeyNow],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, is_learned, next_review_at");
      if (error) throw error;
      const cards = data ?? [];
      const lastAnswers = await fetchLastAnswers(cards.map((c) => c.id));
      return countByState(cards, lastAnswers, serverNow());
    },
  });

  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">Resumen del día</h1>
        <div
          className={`flex items-center gap-2 rounded-full border border-border px-3 py-1.5 shadow-card ${
            streak > 0 ? "bg-primary-soft text-primary" : "bg-card text-muted-foreground"
          }`}
          title={
            streak > 0
              ? `Racha de ${streak} ${streak === 1 ? "día" : "días"}`
              : "Termina una sesión de estudio para iniciar tu racha"
          }
          aria-label={`Racha: ${streak} ${streak === 1 ? "día" : "días"}`}
        >
          <Flame className={`h-5 w-5 ${streak > 0 ? "fill-current" : ""}`} />
          <span className="font-display text-lg font-semibold leading-none">{streak}</span>
          <span className="text-xs leading-none">{streak === 1 ? "día" : "días"}</span>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat
          icon={<Target className="h-4 w-4" />}
          label="Para hoy"
          value={stats?.due ?? 0}
          tone="primary"
        />
        <Stat icon={<Flame className="h-4 w-4" />} label="Nuevas" value={stats?.new ?? 0} />
        <Stat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Falladas"
          value={stats?.failed ?? 0}
          tone="danger"
        />
        <Stat
          icon={<Sparkles className="h-4 w-4" />}
          label="Aprendidas"
          value={stats?.learned ?? 0}
          tone="success"
        />
        <Stat icon={<BookOpen className="h-4 w-4" />} label="Totales" value={stats?.total ?? 0} />
      </section>

      <section className="mt-8 grid gap-3 md:grid-cols-2">
        <Link
          to="/subjects"
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5"
        >
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold">Mis materias</h3>
            <p className="text-sm text-muted-foreground">
              Organiza y estudia por materia
            </p>
          </div>
          <Play className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
        </Link>
        <Link
          to="/learned"
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5"
        >
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold">Aprendidas</h3>
            <p className="text-sm text-muted-foreground">Biblioteca de repaso</p>
          </div>
          <Play className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
        </Link>
        <Link
          to="/create"
          className="group col-span-full flex items-center justify-between rounded-2xl bg-primary p-5 text-primary-foreground shadow-elevated"
        >
          <div>
            <h3 className="font-display text-lg font-semibold">Crear una carta</h3>
            <p className="text-sm opacity-90">Agrega una pregunta con 4 opciones</p>
          </div>
          <Plus className="h-6 w-6" />
        </Link>
      </section>

      {user && stats?.total === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no tienes cartas. Empieza creando tu primera desde una de tus materias.
          </p>
        </div>
      )}
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "primary" | "success" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "success"
        ? "bg-success text-success-foreground"
        : tone === "danger"
          ? "bg-destructive text-destructive-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}
      >
        {icon}
      </div>
      <div className="mt-3 font-display text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
