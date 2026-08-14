import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BookOpen, Sparkles, Plus, Play, Flame, Target } from "lucide-react";

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
  const nowIso = new Date().toISOString();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username").maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", nowIso.slice(0, 10)],
    queryFn: async () => {
      const [dueRes, newRes, learnedRes, totalRes] = await Promise.all([
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("is_learned", false)
          .lte("next_review_at", new Date().toISOString()),
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("is_learned", false)
          .eq("learning_stage", 1)
          .eq("correct_answers_count", 0),
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("is_learned", true),
        supabase.from("flashcards").select("id", { count: "exact", head: true }),
      ]);
      return {
        due: dueRes.count ?? 0,
        newCards: newRes.count ?? 0,
        learned: learnedRes.count ?? 0,
        total: totalRes.count ?? 0,
      };
    },
  });

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Resumen del día</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<Target className="h-4 w-4" />}
          label="Para hoy"
          value={stats?.due ?? 0}
          tone="primary"
        />
        <Stat icon={<Flame className="h-4 w-4" />} label="Nuevas" value={stats?.newCards ?? 0} />
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
  tone?: "primary" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "success"
        ? "bg-success text-success-foreground"
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
