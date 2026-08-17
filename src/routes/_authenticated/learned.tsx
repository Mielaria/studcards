import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CardImage } from "@/components/CardImage";
import { applyAnswer, shuffle, type Stage } from "@/lib/srs";
import { serverNow } from "@/lib/clock";
import { Check, X, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/learned")({
  head: () => ({
    meta: [
      { title: "Aprendidas — StudCards" },
      { name: "description", content: "Tu biblioteca de tarjetas aprendidas en StudCards." },
    ],
  }),
  component: LearnedPage,
});

type Card = {
  id: string;
  question: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  learning_stage: number;
  is_learned: boolean;
  correct_answers_count: number;
  image_url: string | null;
  subject_id: string;
};

function LearnedPage() {
  const [session, setSession] = useState<Card[] | null>(null);
  const [requested, setRequested] = useState<number | "all">("all");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const startedAt = useRef<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const qc = useQueryClient();

  const { data: all } = useQuery({
    queryKey: ["learned-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select(
          "id, question, option_1, option_2, option_3, option_4, correct_option, learning_stage, is_learned, correct_answers_count, image_url, subject_id",
        )
        .eq("is_learned", true);
      if (error) throw error;
      return data as Card[];
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

  function start() {
    if (!all || all.length === 0) return;
    const shuffled = shuffle(all);
    const size = requested === "all" ? shuffled.length : Math.min(requested, shuffled.length);
    setSession(shuffled.slice(0, size));
    setIndex(0);
    setSelected(null);
    setCorrect(0);
    setIncorrect(0);
    startedAt.current = serverNow();
    setElapsed(0);
  }

  const current = session?.[index];
  const shuffledOptions = useMemo(() => {
    if (!current) return [];
    return shuffle([
      { n: 1, text: current.option_1 },
      { n: 2, text: current.option_2 },
      { n: 3, text: current.option_3 },
      { n: 4, text: current.option_4 },
    ]);
  }, [current?.id]);

  const update = useMutation({
    mutationFn: async ({ card, isCorrect }: { card: Card; isCorrect: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const upd = applyAnswer({
        current_stage: card.learning_stage as Stage,
        is_learned: card.is_learned,
        is_correct: isCorrect,
      });
      await supabase
        .from("flashcards")
        .update({
          learning_stage: upd.new_stage,
          next_review_at: upd.next_review_at,
          is_learned: upd.is_learned,
          correct_answers_count:
            card.correct_answers_count + upd.correct_answers_count_delta,
        })
        .eq("id", card.id);
      await supabase.from("card_review_history").insert({
        user_id: user.id,
        flashcard_id: card.id,
        is_correct: isCorrect,
        answered_at: serverNow().toISOString(),
        review_type: "learned",
        previous_stage: card.learning_stage,
        new_stage: upd.new_stage,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learned-cards"] }),
  });

  async function answer(n: number) {
    if (!current || selected !== null) return;
    setSelected(n);
    const isCorrect = n === current.correct_option;
    if (isCorrect) setCorrect((c) => c + 1);
    else setIncorrect((c) => c + 1);
    update.mutate({ card: current, isCorrect });
  }

  function next() {
    if (!session) return;
    if (index + 1 >= session.length) {
      setSession(null);
      toast.success(`Sesión terminada · ${correct}/${correct + incorrect}`);
      return;
    }
    setSelected(null);
    setIndex((i) => i + 1);
  }

  if (session && current) {
    const answered = selected !== null;
    const isCorrect = answered && selected === current.correct_option;
    return (
      <AppShell>
        <header className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {index + 1} / {session.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4" /> {Math.floor(elapsed / 60)}:
            {(elapsed % 60).toString().padStart(2, "0")}
          </span>
        </header>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((index + (answered ? 1 : 0)) / session.length) * 100}%` }}
          />
        </div>
        <article className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card md:p-8">
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
            {shuffledOptions.map(({ n, text }, i) => {
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
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs font-semibold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{text}</span>
                    {answered && isRight && <Check className="h-4 w-4 text-success" />}
                    {answered && isThis && !isRight && (
                      <X className="h-4 w-4 text-destructive" />
                    )}
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
                {isCorrect ? "¡Correcto! Permanece en Aprendidas." : "Falló. Regresa a su materia."}
              </p>
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
      </AppShell>
    );
  }

  const total = all?.length ?? 0;
  return (
    <AppShell>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl font-semibold">Aprendidas</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} carta{total === 1 ? "" : "s"} completaron el ciclo completo.
        </p>
      </header>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          Aún no tienes cartas aprendidas. Completa el ciclo Día 1 → 2 → 5 → 10 → 30 días.
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            {[
              { label: "Todas", value: "all" as const },
              { label: "10 cartas", value: 10 },
              { label: "25 cartas", value: 25 },
              { label: "50 cartas", value: 50 },
            ].map((o) => (
              <button
                key={String(o.value)}
                onClick={() => setRequested(o.value)}
                disabled={typeof o.value === "number" && total < o.value}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-40 ${
                  requested === o.value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-card"
                }`}
              >
                {o.label}
                {requested === o.value && <Check className="h-4 w-4" />}
              </button>
            ))}
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Cantidad personalizada</span>
              <input
                type="number"
                min={1}
                max={total}
                placeholder="Ej: 33"
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v > 0) setRequested(v);
                }}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
              />
            </label>
          </div>
          <button
            onClick={start}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-elevated"
          >
            Empezar repaso
          </button>
        </>
      )}
    </AppShell>
  );
}
