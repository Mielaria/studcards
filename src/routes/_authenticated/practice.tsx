import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { fetchCardsByIds } from "@/lib/card-fetch";
import { AppShell } from "@/components/AppShell";
import { ExplanationModal } from "@/components/ExplanationModal";
import { CardImage } from "@/components/CardImage";
import { shuffle } from "@/lib/srs";
import { playAnswerSound } from "@/lib/sfx";
import { Check, X, Clock, Zap, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({
    meta: [
      { title: "Repasar ahora — StudCards" },
      { name: "description", content: "Repasa cartas sin afectar tu progreso de repetición espaciada." },
    ],
  }),
  component: PracticePage,
});

type Card = {
  id: string;
  question: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  image_url: string | null;
  explanation: string | null;
  subject_id: string;
};

const CARD_SELECT =
  "id, question, option_1, option_2, option_3, option_4, correct_option, image_url, explanation, subject_id";

function PracticePage() {
  const [scope, setScope] = useState<string>("all");
  const [count, setCount] = useState<number | "all">(20);
  const [session, setSession] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const startedAt = useRef<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const { data: subjects } = useQuery({
    queryKey: ["subjects-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, name").order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      if (startedAt.current)
        setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [session]);

  async function start() {
    let ids: string[];
    try {
      // 1) Solo IDs: no se descarga el contenido de miles de cartas.
      const rows = await fetchAllRows<{ id: string }>((from, to) => {
        let q = supabase.from("flashcards").select("id");
        if (scope !== "all") q = q.eq("subject_id", scope);
        return q.order("created_at", { ascending: false }).range(from, to);
      });
      ids = rows.map((r) => r.id);
    } catch (e) {
      return toast.error((e as Error).message);
    }
    if (ids.length === 0) return toast.error("No hay cartas para repasar");
    const pool = shuffle(ids);
    const size = count === "all" ? pool.length : Math.min(count, pool.length);
    const picked = pool.slice(0, size);
    let cards: Card[];
    try {
      // 2) Contenido completo SOLO de las cartas de esta sesión.
      cards = await fetchCardsByIds<Card>(CARD_SELECT, picked);
    } catch (e) {
      return toast.error((e as Error).message);
    }
    const order = new Map(picked.map((id, i) => [id, i]));
    cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    setSession(cards);
    setIndex(0);
    setSelected(null);
    setShowExplanation(false);
    setCorrect(0);
    setIncorrect(0);
    startedAt.current = new Date();
    setElapsed(0);
  }


  const current = session?.[index];
  const opts = useMemo(() => {
    if (!current) return [];
    return shuffle([
      { n: 1, text: current.option_1 },
      { n: 2, text: current.option_2 },
      { n: 3, text: current.option_3 },
      { n: 4, text: current.option_4 },
    ]);
  }, [current?.id]);

  function answer(n: number) {
    if (!current || selected !== null) return;
    setSelected(n);
    const ok = n === current.correct_option;
    playAnswerSound(ok);
    if (ok) setCorrect((c) => c + 1);
    else setIncorrect((c) => c + 1);
  }

  function next() {
    if (!session) return;
    if (index + 1 >= session.length) {
      toast.success(`Repaso terminado · ${correct}/${correct + incorrect}`);
      setSession(null);
      return;
    }
    setSelected(null);
    setShowExplanation(false);
    setIndex((i) => i + 1);
  }

  if (!session) {
    return (
      <AppShell>
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Repasar ahora</h1>
            <p className="text-sm text-muted-foreground">
              Sesión libre — no afecta tu progreso ni el ciclo de repetición.
            </p>
          </div>
        </header>

        <div className="grid gap-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Materia</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            >
              <option value="all">Todas mis materias</option>
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium">Cantidad</span>
            <div className="grid grid-cols-4 gap-2">
              {(["all", 10, 20, 50] as const).map((n) => (
                <button
                  key={String(n)}
                  onClick={() => setCount(n)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                    count === n
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card"
                  }`}
                >
                  {n === "all" ? "Todas" : n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={start}
            className="mt-3 rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-elevated"
          >
            Empezar repaso
          </button>
        </div>
      </AppShell>
    );
  }

  if (!current) return null;
  const answered = selected !== null;
  const isCorrect = answered && selected === current.correct_option;
  const total = correct + incorrect;

  return (
    <AppShell>
      <header className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {index + 1} / {session.length} · Repaso libre
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-4 w-4" /> {Math.floor(elapsed / 60)}:
          {(elapsed % 60).toString().padStart(2, "0")}
        </span>
      </header>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${((index + (answered ? 1 : 0)) / session.length) * 100}%`,
          }}
        />
      </div>

      <article className="relative mt-6 rounded-3xl border border-border bg-card p-5 shadow-card md:p-8">
        <button
          type="button"
          onClick={() => setShowExplanation(true)}
          aria-label="Ver respuesta y explicación"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-warning/40 bg-warning/15 text-warning shadow-card"
        >
          <Lightbulb className="h-4 w-4" />
        </button>
        <ExplanationModal
          open={showExplanation}
          onClose={() => setShowExplanation(false)}
          correctAnswer={
            [current.option_1, current.option_2, current.option_3, current.option_4][
              current.correct_option - 1
            ]
          }
          explanation={current.explanation}
          footer="En Repasar ahora no afecta tu progreso."
          variant="info"
        />
        {current.image_url && (
          <CardImage
            value={current.image_url}
            alt=""
            className="mb-4 max-h-72 w-full rounded-2xl bg-muted object-contain"
          />
        )}
        <h2 className="font-display text-xl font-semibold leading-snug md:text-2xl">
          {current.question}
        </h2>
        <ul className="mt-5 grid gap-2">
          {opts.map(({ n, text }) => {
            const isThis = selected === n;
            const isRight = n === current.correct_option;
            let styles = "border-border bg-background";
            if (answered) {
              if (isRight) styles = "border-success bg-success/10";
              else if (isThis) styles = "border-destructive bg-destructive/10";
              else styles = "border-border bg-background opacity-60";
            }
            return (
              <li key={n}>
                <button
                  disabled={answered}
                  onClick={() => answer(n)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors ${styles}`}
                >
                  <span className="flex-1">{text}</span>
                  {answered && isRight && <Check className="h-4 w-4 text-success" />}
                  {answered && isThis && !isRight && <X className="h-4 w-4 text-destructive" />}
                </button>
              </li>
            );
          })}
        </ul>
        {answered && (
          <div
            className={`mt-5 rounded-2xl p-4 text-sm ${
              isCorrect ? "bg-success/15" : "bg-destructive/10"
            }`}
          >
            <p className="font-semibold">
              {isCorrect ? "¡Correcto!" : "Respuesta incorrecta"}
            </p>
            {!isCorrect && (
              <p className="mt-1 opacity-90">
                Correcta:{" "}
                <span className="font-medium">
                  {[current.option_1, current.option_2, current.option_3, current.option_4][
                    current.correct_option - 1
                  ]}
                </span>
              </p>
            )}
          </div>
        )}
      </article>

      {answered && (
        <button
          onClick={next}
          className="mt-6 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-elevated"
        >
          {index + 1 >= session.length ? "Terminar" : "Continuar"}
        </button>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>✓ {correct}</span>
        <span>Precisión: {total ? Math.round((correct / total) * 100) : 0}%</span>
        <span>✗ {incorrect}</span>
      </div>
    </AppShell>
  );
}
