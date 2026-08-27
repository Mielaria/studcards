import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { AppShell } from "@/components/AppShell";
import { ExplanationModal } from "@/components/ExplanationModal";
import { CardImage } from "@/components/CardImage";
import { applyAnswer, shuffle, type Stage } from "@/lib/srs";
import { buildDailyQueue, type QueueBreakdown } from "@/lib/study-queue";
import { fetchLastAnswers } from "@/lib/card-state";
import { fetchCardsByIds } from "@/lib/card-fetch";
import { WRITTEN_ANSWER_PROBABILITY, answersMatch } from "@/lib/written";
import { readWrittenEnabled } from "@/lib/written-pref";
import { readAudioOnly } from "@/lib/audio-pref";
import {
  createEnglishRecognition,
  isSpeechRecognitionSupported,
  speakEnglish,
} from "@/lib/speech";
import { serverNow, syncClock } from "@/lib/clock";
import { ArrowLeft, Check, X, Clock, Lightbulb, AlertTriangle, PenLine, Mic, Volume2 } from "lucide-react";
import { toast } from "sonner";

type StudyMode = "all" | "failed";

export const Route = createFileRoute("/_authenticated/subjects/$id/study")({
  validateSearch: (search: Record<string, unknown>): { mode: StudyMode } => ({
    mode: search["mode"] === "failed" ? "failed" : "all",
  }),
  head: () => ({ meta: [{ title: "Estudiar — StudCards" }, { name: "robots", content: "noindex" }] }),
  component: StudyPage,
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
  explanation: string | null;
  next_review_at: string;
};

export const CARD_SELECT =
  "id, question, option_1, option_2, option_3, option_4, correct_option, learning_stage, is_learned, correct_answers_count, image_url, explanation, next_review_at";

function StudyPage() {
  const { id: subjectId } = Route.useParams();
  const { mode } = Route.useSearch();
  const [phase, setPhase] = useState<"setup" | "session" | "done">("setup");
  const [requestedCount, setRequestedCount] = useState<number | "all">("all");
  const [available, setAvailable] = useState<QueueBreakdown | null>(null);

  useEffect(() => {
    (async () => {
      await syncClock();
      const cards = await fetchAllRows<{
        id: string;
        is_learned: boolean;
        next_review_at: string;
      }>((from, to) =>
        supabase
          .from("flashcards")
          .select("id, is_learned, next_review_at")
          .eq("subject_id", subjectId)
          .order("created_at", { ascending: false })
          .range(from, to),
      );
      const lastAnswers = await fetchLastAnswers(cards.map((c) => c.id));
      const res = buildDailyQueue({
        cards,
        lastAnswers,
        now: serverNow(),
        limit: "all",
        only: mode === "failed" ? "failed" : undefined,
      });
      setAvailable(res.available);
    })();
  }, [subjectId, mode]);

  const totalAvailable = available
    ? available.failed + available.learning + available.new
    : null;

  if (phase === "setup") {
    return (
      <AppShell>
        <div className="mb-4">
          <Link
            to="/subjects/$id"
            params={{ id: subjectId }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </div>
        <h1 className="font-display text-2xl font-semibold">
          {mode === "failed" ? "Repasar falladas" : "Configura tu sesión"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalAvailable === null
            ? "Calculando cartas disponibles…"
            : `${totalAvailable} carta${totalAvailable === 1 ? "" : "s"} disponible${totalAvailable === 1 ? "" : "s"} para hoy`}
        </p>
        {available && totalAvailable ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-destructive">
              <AlertTriangle className="h-3 w-3" /> {available.failed} falladas
            </span>
            <span className="rounded-full border border-border px-3 py-1">
              {available.learning} repasos
            </span>
            <span className="rounded-full border border-border px-3 py-1">
              {available.new} nuevas
            </span>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          <QuickCount
            label="Todas"
            active={requestedCount === "all"}
            onClick={() => setRequestedCount("all")}
          />
          {[10, 20, 50].map((n) => (
            <QuickCount
              key={n}
              label={`${n} cartas`}
              active={requestedCount === n}
              disabled={totalAvailable !== null && totalAvailable < n}
              onClick={() => setRequestedCount(n)}
            />
          ))}
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Cantidad personalizada</span>
            <input
              type="number"
              min={1}
              max={totalAvailable ?? undefined}
              placeholder="Ej: 33"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) setRequestedCount(v);
              }}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
            />
          </label>
        </div>

        <button
          disabled={!totalAvailable}
          onClick={() => setPhase("session")}
          className="mt-8 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
        >
          Empezar sesión
        </button>
      </AppShell>
    );
  }

  if (phase === "session") {
    return (
      <StudySession
        subjectId={subjectId}
        mode={mode}
        requested={requestedCount}
        onFinish={() => setPhase("done")}
      />
    );
  }

  return (
    <AppShell>
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">¡Sesión completada!</h1>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/subjects/$id"
            params={{ id: subjectId }}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium"
          >
            Volver a la materia
          </Link>
          <button
            onClick={() => setPhase("setup")}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Otra sesión
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function QuickCount({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40 ${
        active ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"
      }`}
    >
      {label}
      {active && <Check className="h-4 w-4" />}
    </button>
  );
}

function StudySession({
  subjectId,
  mode,
  requested,
  onFinish,
}: {
  subjectId: string;
  mode: StudyMode;
  requested: number | "all";
  onFinish: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [writtenInput, setWrittenInput] = useState("");
  const [writtenResult, setWrittenResult] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [breakdown, setBreakdown] = useState<QueueBreakdown | null>(null);
  const startedAt = useRef(serverNow());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      await syncClock();
      try {
        // 1) Solo metadatos ligeros para decidir la cola (miles de cartas OK).
        const light = await fetchAllRows<{
          id: string;
          is_learned: boolean;
          next_review_at: string;
        }>((from, to) =>
          supabase
            .from("flashcards")
            .select("id, is_learned, next_review_at")
            .eq("subject_id", subjectId)
            .order("created_at", { ascending: false })
            .range(from, to),
        );
        const lastAnswers = await fetchLastAnswers(light.map((c) => c.id));
        const result = buildDailyQueue({
          cards: light,
          lastAnswers,
          now: serverNow(),
          limit: requested,
          only: mode === "failed" ? "failed" : undefined,
        });
        setBreakdown(result.breakdown);
        // 2) Contenido completo SOLO de las cartas que entran en la sesión.
        const full = await fetchCardsByIds<Card>(
          CARD_SELECT,
          result.queue.map((c) => c.id),
        );
        const byId = new Map(full.map((c) => [c.id, c]));
        const queue = result.queue
          .map((c) => byId.get(c.id))
          .filter((c): c is Card => Boolean(c));
        setQueue(queue);
        const size = queue.length;

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: sess } = await supabase
            .from("study_sessions")
            .insert({
              user_id: user.id,
              session_type: "subject",
              subject_id: subjectId,
              cards_requested: size,
            })
            .select("id")
            .single();
          if (sess) setSessionId(sess.id);
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
  }, [subjectId, requested, mode]);

  const current = queue?.[index];

  const shuffledOptions = useMemo(() => {
    if (!current) return [];
    const opts = [
      { n: 1, text: current.option_1 },
      { n: 2, text: current.option_2 },
      { n: 3, text: current.option_3 },
      { n: 4, text: current.option_4 },
    ];
    return shuffle(opts);
  }, [current?.id]);

  // La modalidad (opción múltiple vs respuesta escrita) se sortea en CADA
  // aparición de la carta y NUNCA se guarda en Supabase: la misma carta puede
  // aparecer como opción múltiple una vez y como respuesta escrita otra.
  const audioOnly = useMemo(() => readAudioOnly(subjectId), [subjectId]);
  const isWritten = useMemo(
    () =>
      !audioOnly &&
      readWrittenEnabled(subjectId) &&
      Math.random() < WRITTEN_ANSWER_PROBABILITY,
    [current?.id, subjectId, audioOnly],
  );
  const correctText = current
    ? [current.option_1, current.option_2, current.option_3, current.option_4][
        current.correct_option - 1
      ]
    : "";

  // Registra el resultado (acierto/fallo) con la MISMA lógica SRS para
  // opción múltiple y respuesta escrita.
  async function registerResult(isCorrect: boolean) {
    if (!current) return;
    if (isCorrect) setCorrect((c) => c + 1);
    else setIncorrect((c) => c + 1);

    // Repaso de falladas: práctica neutral. No cambia etapa, ni next_review_at,
    // ni escribe historial, por lo que la carta sigue fallada y vuelve mañana.
    if (mode === "failed") return;

    const update = applyAnswer({
      current_stage: current.learning_stage as Stage,
      is_learned: current.is_learned,
      is_correct: isCorrect,
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("flashcards")
        .update({
          learning_stage: update.new_stage,
          next_review_at: update.next_review_at,
          is_learned: update.is_learned,
          correct_answers_count:
            current.correct_answers_count + update.correct_answers_count_delta,
        })
        .eq("id", current.id);
      await supabase.from("card_review_history").insert({
        user_id: user.id,
        flashcard_id: current.id,
        answered_at: serverNow().toISOString(),
        study_session_id: sessionId,
        is_correct: isCorrect,
        review_type: "scheduled",
        previous_stage: current.learning_stage,
        new_stage: update.new_stage,
      });
    }
  }

  async function answer(optionN: number) {
    if (!current || selected !== null) return;
    setSelected(optionN);
    await registerResult(optionN === current.correct_option);
  }

  async function submitWritten() {
    if (!current || writtenResult !== null) return;
    if (!writtenInput.trim()) return;
    const ok = answersMatch(writtenInput, correctText);
    setWrittenResult(ok);
    await registerResult(ok);
  }

  async function revealAnswer() {
    if (!current) return;
    setShowExplanation(true);
    if (selected !== null || writtenResult !== null) return;
    // Ver la respuesta cuenta como fallo: vuelve a Etapa 1 (mañana).
    if (isWritten) setWrittenResult(false);
    else setSelected(0);
    await registerResult(false);
  }

  async function next() {
    if (!queue) return;
    if (index + 1 >= queue.length) {
      // finish
      const durationSeconds = Math.floor((Date.now() - startedAt.current.getTime()) / 1000);
      const studied = correct + incorrect;
      if (sessionId) {
        await supabase
          .from("study_sessions")
          .update({
            completed_at: serverNow().toISOString(),
            duration_seconds: durationSeconds,
            cards_studied: studied,
            correct_count: correct,
            incorrect_count: incorrect,
            accuracy: studied ? Number(((correct / studied) * 100).toFixed(2)) : 0,
          })
          .eq("id", sessionId);
      }
      await qc.invalidateQueries();
      onFinish();
      return;
    }
    setSelected(null);
    setWrittenInput("");
    setWrittenResult(null);
    setShowExplanation(false);
    setIndex((i) => i + 1);
  }

  if (!queue)
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </AppShell>
    );

  if (queue.length === 0)
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay cartas para estudiar ahora en esta materia.
          </p>
          <button
            onClick={() => navigate({ to: "/subjects/$id", params: { id: subjectId } })}
            className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Volver
          </button>
        </div>
      </AppShell>
    );

  if (!current) return null;

  const answered = selected !== null || writtenResult !== null;
  const isCorrect =
    selected !== null
      ? selected === current.correct_option
      : writtenResult === true;
  const totalStudied = correct + incorrect;
  const finishing = answered && index + 1 >= queue.length;

  return (
    <AppShell>
      <header className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-display text-lg font-bold">
          <span className="text-primary">{index + 1}</span>
          <span className="text-muted-foreground"> / {queue.length}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-4 w-4" /> {formatTime(elapsed)}
        </span>
      </header>

      {breakdown && (
        <p className="mb-3 text-xs text-muted-foreground">
          {breakdown.failed} falladas · {breakdown.learning} repasos · {breakdown.new} nuevas
        </p>
      )}

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((index + (answered ? 1 : 0)) / queue.length) * 100}%` }}
        />
      </div>

      <article className="relative mt-6 rounded-3xl border border-border bg-card p-5 shadow-card md:p-8">
        <button
          type="button"
          onClick={revealAnswer}
          aria-label="Ver respuesta y explicación"
          title="Ver respuesta y explicación (cuenta como fallo)"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-warning/40 bg-warning/15 text-warning shadow-card transition-transform hover:scale-105"
        >
          <Lightbulb className="h-4 w-4" />
        </button>
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

        {audioOnly ? (
          <VoiceAnswer
            key={current.id}
            answered={answered}
            isCorrect={isCorrect}
            correctText={correctText}
            onResult={(text) => {
              if (writtenResult !== null) return;
              setWrittenInput(text);
              const ok = answersMatch(text, correctText);
              setWrittenResult(ok);
              registerResult(ok);
            }}
            transcript={writtenInput}
          />
        ) : isWritten ? (
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <PenLine className="h-3.5 w-3.5" /> Respuesta escrita — escribe la
              opción correcta
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitWritten();
              }}
              className="flex gap-2"
            >
              <input
                value={writtenInput}
                onChange={(e) => setWrittenInput(e.target.value)}
                disabled={answered}
                placeholder="Escribe tu respuesta…"
                aria-label="Tu respuesta"
                autoFocus
                className={`min-w-0 flex-1 rounded-xl border px-3.5 py-3 text-sm outline-none ${
                  answered
                    ? isCorrect
                      ? "border-success bg-success/10"
                      : "border-destructive bg-destructive/10"
                    : "border-input bg-background focus:border-primary"
                }`}
              />
              {!answered && (
                <button
                  type="submit"
                  disabled={!writtenInput.trim()}
                  className="rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Comprobar
                </button>
              )}
            </form>
            {answered && (
              <p className="mt-2 text-xs text-muted-foreground">
                Respuesta correcta:{" "}
                <span className="font-medium text-foreground">{correctText}</span>
              </p>
            )}
          </div>
        ) : (
          <ul className="mt-5 grid gap-2">
            {shuffledOptions.map(({ n, text }) => {
              const isThis = selected === n;
              const isRight = n === current.correct_option;
              let styles = "border-border bg-background";
              if (answered) {
                if (isRight) styles = "border-success bg-success/10 text-success-foreground";
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
                      {String.fromCharCode(64 + shuffledOptions.findIndex((o) => o.n === n) + 1)}
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
        )}

        {answered && (
          <div
            className={`mt-5 rounded-2xl p-4 text-sm ${
              isCorrect
                ? "bg-success/15 text-success-foreground"
                : "bg-destructive/10 text-destructive-foreground"
            }`}
          >
            <p className="font-semibold">
              {isCorrect ? "¡Correcto!" : "Respuesta incorrecta"}
            </p>
            {!isCorrect && (
              <p className="mt-1 opacity-90">
                La respuesta correcta era:{" "}
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
          {finishing ? "Terminar" : "Continuar"}
        </button>
      )}

      <ExplanationModal
        open={showExplanation}
        onClose={() => setShowExplanation(false)}
        correctAnswer={
          [current.option_1, current.option_2, current.option_3, current.option_4][
            current.correct_option - 1
          ]
        }
        explanation={current.explanation}
        footer={
          mode === "failed"
            ? "Repaso de práctica: la carta sigue fallada y volverá en tu estudio de mañana."
            : "Esta carta se marcó como fallada y se repasará mañana."
        }
        variant="penalty"
      />

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>✓ {correct}</span>
        <span>
          Precisión: {totalStudied ? Math.round((correct / totalStudied) * 100) : 0}%
        </span>
        <span>✗ {incorrect}</span>
      </div>
    </AppShell>
  );
}

function VoiceAnswer({
  answered,
  isCorrect,
  correctText,
  transcript,
  onResult,
}: {
  answered: boolean;
  isCorrect: boolean;
  correctText: string;
  transcript: string;
  onResult: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<ReturnType<typeof createEnglishRecognition>>(null);
  const supported = isSpeechRecognitionSupported();

  useEffect(() => () => recRef.current?.abort(), []);

  function start() {
    if (answered || listening) return;
    const rec = createEnglishRecognition();
    if (!rec) {
      toast.error("Tu navegador no permite reconocimiento de voz.");
      return;
    }
    recRef.current = rec;
    setInterim("");
    rec.onresult = (event: any) => {
      let text = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        text += result[0].transcript;
        if (result.isFinal) isFinal = true;
      }
      setInterim(text);
      if (isFinal) {
        // Acepta cualquiera de las alternativas reconocidas si coincide.
        const last = event.results[event.results.length - 1];
        let best = text;
        for (let a = 0; a < last.length; a++) {
          if (answersMatch(last[a].transcript, correctText)) {
            best = last[a].transcript;
            break;
          }
        }
        rec.stop();
        setListening(false);
        onResult(best.trim());
      }
    };
    rec.onerror = () => {
      setListening(false);
      toast.error("No se pudo escuchar. Revisa el permiso del micrófono.");
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      {!answered && (
        <>
          <button
            type="button"
            onClick={start}
            disabled={!supported}
            aria-label="Hablar la respuesta en inglés"
            className={`flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground shadow-elevated transition-transform disabled:opacity-50 ${
              listening ? "animate-pulse bg-destructive" : "bg-primary hover:scale-105"
            }`}
          >
            <Mic className="h-8 w-8" />
          </button>
          <p className="text-xs text-muted-foreground">
            {!supported
              ? "Tu navegador no permite reconocimiento de voz."
              : listening
                ? "Escuchando… di la respuesta en inglés"
                : "Toca el micrófono y di la respuesta en inglés"}
          </p>
          {interim && <p className="text-sm font-medium">{interim}</p>}
        </>
      )}
      {answered && (
        <div className="w-full text-center">
          <p
            className={`text-base font-semibold ${
              isCorrect ? "text-success" : "text-destructive"
            }`}
          >
            “{transcript || "—"}”
          </p>
          <button
            type="button"
            onClick={() => speakEnglish(correctText)}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm"
          >
            <Volume2 className="h-4 w-4" /> Escuchar: {correctText}
          </button>
        </div>
      )}
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
