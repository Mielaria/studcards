import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { GraduationCap, Sparkles, BookOpen, Timer } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudCards — Aprende con flashcards y repetición espaciada" },
      {
        name: "description",
        content:
          "Crea tarjetas por materia, estudia con 4 opciones y deja que el algoritmo decida cuándo repasar.",
      },
      { property: "og:title", content: "StudCards" },
      {
        property: "og:description",
        content: "Flashcards con repetición espaciada, tuyas y organizadas por materia.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const session = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold">StudCards</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/auth"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Entrar
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-10 pt-8 md:px-8 md:pb-16 md:pt-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Aprende de verdad
            </span>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight md:text-5xl">
              Tus tarjetas de estudio, con repetición espaciada.
            </h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              Crea flashcards con 4 opciones, organízalas por materia y deja que StudCards
              decida cuándo repasar cada carta para que no la olvides.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-elevated hover:opacity-90"
              >
                Crear cuenta gratis
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-medium hover:bg-muted"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
          <div className="grid gap-3">
            <FeatureCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Organiza por materia"
              desc="Materias iniciales listas y todas las que quieras crear."
            />
            <FeatureCard
              icon={<Timer className="h-5 w-5" />}
              title="Ciclo 1 · 2 · 5 · 10 · 30 días"
              desc="Cada carta reaparece en el momento justo para reforzarla."
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Zona Aprendidas"
              desc="Las cartas que dominas viven en una biblioteca de repaso."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

// Unused imports guard (kept to avoid tree-shaking oddities in dev): reference redirect + supabase
void redirect;
void supabase;
