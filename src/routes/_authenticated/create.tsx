import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import {
  Check,
  Image as ImageIcon,
  Sparkles,
  PencilLine,
  Trash2,
  Upload,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { getCroppedDataUrl, fileToDataUrl } from "@/lib/image-crop";
import { CARD_BUCKET, uploadDataUrl } from "@/lib/card-images";
import { generateCards, type GeneratedCard } from "@/lib/ai-cards.functions";

const search = z.object({ subject: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/create")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Crear carta — StudCards" }] }),
  component: CreatePage,
});

type Mode = "manual" | "ai";

function capitalizeFirst(s: string) {
  return s.length ? s.charAt(0).toLocaleUpperCase("es-ES") + s.slice(1) : s;
}

function CreatePage() {
  const { subject: initialSubject } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("manual");
  const [subjectId, setSubjectId] = useState<string>(initialSubject ?? "");
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const qc = useQueryClient();

  const { data: subjects } = useQuery({
    queryKey: ["subjects-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createSubject = useMutation({
    mutationFn: async (name: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No auth");
      const clean = capitalizeFirst(name.trim());
      const { data, error } = await supabase
        .from("subjects")
        .insert({ user_id: user.id, name: clean, icon: "book" })
        .select("id, name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (row) => {
      toast.success("Materia creada");
      setNewSubjectName("");
      setAddingSubject(false);
      // Añade la materia al cache al instante para poder seleccionarla ya
      qc.setQueryData<{ id: string; name: string }[]>(["subjects-simple"], (old) =>
        old ? [...old, row] : [row],
      );
      setSubjectId(row.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["subjects-simple"] }),
        qc.invalidateQueries({ queryKey: ["subjects-with-counts"] }),
      ]);
      setSubjectId(row.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <AppShell>
      <h1 className="font-display text-2xl font-semibold">Nueva carta</h1>
      <p className="text-sm text-muted-foreground">
        Crea manualmente o genera con IA desde una foto o texto.
      </p>

      <div className="mt-5 inline-flex rounded-full border border-border bg-card p-1">
        <TabBtn active={mode === "manual"} onClick={() => setMode("manual")}>
          <PencilLine className="h-4 w-4" /> Manual
        </TabBtn>
        <TabBtn active={mode === "ai"} onClick={() => setMode("ai")}>
          <Sparkles className="h-4 w-4" /> Foto / IA
        </TabBtn>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium">Materia</span>
          {!addingSubject && (
            <button
              type="button"
              onClick={() => setAddingSubject(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-elevated"
              aria-label="Nueva materia"
            >
              <Plus className="h-4 w-4" /> Nueva
            </button>
          )}
        </div>

        {addingSubject ? (
          <div className="flex items-center gap-2">
            <input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(capitalizeFirst(e.target.value))}
              placeholder="Nombre de materia"
              autoFocus
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSubjectName.trim()) {
                  createSubject.mutate(newSubjectName);
                } else if (e.key === "Escape") {
                  setAddingSubject(false);
                  setNewSubjectName("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => newSubjectName.trim() && createSubject.mutate(newSubjectName)}
              disabled={!newSubjectName.trim() || createSubject.isPending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
              aria-label="Crear materia"
            >
              {createSubject.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingSubject(false);
                setNewSubjectName("");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
            required
          >
            <option value="">— Selecciona —</option>
            {subjects?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {mode === "manual" ? (
        <ManualForm subjectId={subjectId} />
      ) : (
        <AiForm subjectId={subjectId} />
      )}
    </AppShell>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------- Manual ----------------

function ManualForm({ subjectId }: { subjectId: string }) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No auth");
      if (!subjectId) throw new Error("Elige una materia");
      if (!question.trim()) throw new Error("La pregunta es obligatoria");
      if (options.some((o) => !o.trim()))
        throw new Error("Todas las respuestas son obligatorias");
      if (!correct) throw new Error("Marca la respuesta correcta");
      // La imagen sólo se sube a Storage al guardar: si cancelas, no queda nada.
      const imagePath = imageDataUrl
        ? await uploadDataUrl(CARD_BUCKET, imageDataUrl)
        : null;
      const { error } = await supabase.from("flashcards").insert({
        user_id: user.id,
        subject_id: subjectId,
        question: question.trim(),
        option_1: options[0].trim(),
        option_2: options[1].trim(),
        option_3: options[2].trim(),
        option_4: options[3].trim(),
        correct_option: correct,
        explanation: explanation.trim() || null,
        image_url: imagePath,
        learning_stage: 1,
        next_review_at: new Date().toISOString(),
        correct_answers_count: 0,
        is_learned: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Carta creada");
      navigate({ to: "/subjects/$id", params: { id: subjectId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-6 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Pregunta</span>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          required
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 block text-sm font-medium">
          Opciones (marca la correcta)
        </legend>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrect(i + 1)}
              aria-label={`Marcar opción ${i + 1} como correcta`}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                correct === i + 1
                  ? "border-success bg-success text-success-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {correct === i + 1 ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-xs font-semibold">
                  {String.fromCharCode(65 + i)}
                </span>
              )}
            </button>
            <input
              value={opt}
              onChange={(e) => {
                const copy = [...options];
                copy[i] = e.target.value;
                setOptions(copy);
              }}
              required
              placeholder={`Respuesta ${i + 1}`}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
            />
          </div>
        ))}
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">
          Explicación de la respuesta correcta (opcional)
        </span>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          placeholder="Por qué la opción marcada es la correcta…"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Se mostrará al pulsar la bombilla mientras estudias (cuenta como fallo).
        </span>
      </label>

      <ImagePicker value={imageDataUrl} onChange={setImageDataUrl} />

      <button
        type="submit"
        disabled={save.isPending}
        className="mt-2 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
      >
        {save.isPending ? "Guardando…" : "Guardar carta"}
      </button>
    </form>
  );
}

// ---------------- Image picker with react-image-crop ----------------

function ImagePicker({
  value,
  onChange,
  required = false,
  includeImageAction,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  required?: boolean;
  includeImageAction?: React.ReactNode;
}) {
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [pixelCrop, setPixelCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  async function onFile(f: File) {
    if (f.size > 8 * 1024 * 1024) return toast.error("Imagen demasiado grande (máx 8 MB)");
    const url = await fileToDataUrl(f);
    setRawUrl(url);
    onChange(null);
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    // Por defecto se selecciona la imagen completa para no perder contenido
    setCrop({ unit: "px", x: 0, y: 0, width, height });
    setPixelCrop({ unit: "px", x: 0, y: 0, width, height });
  }

  async function confirmCrop() {
    if (!imgRef.current || !pixelCrop) return;
    const dataUrl = await getCroppedDataUrl(imgRef.current, pixelCrop);
    onChange(dataUrl);
    setRawUrl(null);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <ImageIcon className="h-4 w-4" /> {required ? "Foto requerida" : "Imagen (opcional)"}
      </div>

      {value && !rawUrl && (
        <div className="mb-3">
          <img src={value} alt="" className="max-h-56 w-full rounded-lg object-contain bg-muted" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {includeImageAction}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 text-xs text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Quitar
            </button>
          </div>
        </div>
      )}

      {rawUrl && (
        <div className="mb-3">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setPixelCrop(c)}
          >
            <img
              ref={imgRef}
              src={rawUrl}
              onLoad={onImageLoad}
              alt=""
              style={{ maxHeight: 360, width: "auto" }}
            />
          </ReactCrop>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {includeImageAction}
            <button
              type="button"
              onClick={confirmCrop}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Usar para crear carta
            </button>
            <button
              type="button"
              onClick={() => setRawUrl(null)}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold">
        <Upload className="h-4 w-4" />
        {value ? "Cambiar imagen" : "Subir imagen"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

// ---------------- AI form ----------------

function AiForm({ subjectId }: { subjectId: string }) {
  const gen = useServerFn(generateCards);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [includeImageInCards, setIncludeImageInCards] = useState(false);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [count, setCount] = useState(1);
  const [drafts, setDrafts] = useState<GeneratedCard[]>([]);
  const [loading, setLoading] = useState(false);

  async function runGenerate() {
    if (!imageDataUrl) {
      toast.error("Sube una foto para generar las cartas");
      return;
    }
    setLoading(true);
    try {
      const res = await gen({
        data: {
          count,
          text: text.trim() || undefined,
          imageDataUrl: imageDataUrl,
          hint: hint.trim() || undefined,
        },
      });
      setDrafts(res.cards);
      toast.success(`${res.cards.length} carta(s) generada(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar");
    } finally {
      setLoading(false);
    }
  }

  const saveAll = useMutation({
    mutationFn: async () => {
      if (!subjectId) throw new Error("Elige una materia");
      if (drafts.length === 0) throw new Error("No hay cartas");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No auth");
      const now = new Date().toISOString();
      // La foto de entrada de la IA sólo se guarda si decides incluirla en las cartas.
      // Cada carta recibe su propia copia en Storage para que borrar una no afecte a las demás.
      const rows = await Promise.all(
        drafts.map(async (c) => ({
          user_id: user.id,
          subject_id: subjectId,
          question: c.question,
          option_1: c.options[0],
          option_2: c.options[1],
          option_3: c.options[2],
          option_4: c.options[3],
          correct_option: (c.correctIndex + 1) as 1 | 2 | 3 | 4,
          explanation: c.explanation?.trim() || null,
          image_url:
            includeImageInCards && imageDataUrl
              ? await uploadDataUrl(CARD_BUCKET, imageDataUrl)
              : null,
          learning_stage: 1,
          next_review_at: now,
          correct_answers_count: 0,
          is_learned: false,
        })),
      );
      const { error } = await supabase.from("flashcards").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cartas guardadas");
      qc.invalidateQueries();
      navigate({ to: "/subjects/$id", params: { id: subjectId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 grid gap-4">
      <ImagePicker
        value={imageDataUrl}
        onChange={setImageDataUrl}
        required
        includeImageAction={
          imageDataUrl ? (
            <button
              type="button"
              onClick={() => setIncludeImageInCards((v) => !v)}
              aria-pressed={includeImageInCards}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                includeImageInCards
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                  includeImageInCards
                    ? "border-primary-foreground/40 bg-primary-foreground/20"
                    : "border-border"
                }`}
              >
                {includeImageInCards ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
              Agregar imagen a la carta
            </button>
          ) : null
        }
      />

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Texto de apoyo (opcional)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Fragmento de un libro, apuntes, resumen…"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
        />
      </label>


      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Enfoque (opcional)</span>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Ej: fechas y nombres"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">¿Cuántas cartas?</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={runGenerate}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Generando…" : "Generar con IA"}
      </button>

      {drafts.length > 0 && (
        <section className="mt-2 grid gap-3">
          <h2 className="font-display text-lg font-semibold">Revisa y edita</h2>
          {drafts.map((c, i) => (
            <DraftEditor
              key={i}
              card={c}
              onChange={(nc) =>
                setDrafts((d) => d.map((x, j) => (i === j ? nc : x)))
              }
              onRemove={() => setDrafts((d) => d.filter((_, j) => j !== i))}
            />
          ))}
          <button
            onClick={() => saveAll.mutate()}
            disabled={saveAll.isPending || !subjectId}
            className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
          >
            {saveAll.isPending ? "Guardando…" : `Guardar ${drafts.length} carta(s)`}
          </button>
        </section>
      )}
    </div>
  );
}

function DraftEditor({
  card,
  onChange,
  onRemove,
}: {
  card: GeneratedCard;
  onChange: (c: GeneratedCard) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <textarea
          value={card.question}
          onChange={(e) => onChange({ ...card, question: e.target.value })}
          rows={2}
          className="flex-1 rounded-lg border border-input bg-background p-2 text-sm"
        />
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 grid gap-2">
        {card.options.map((opt, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...card, correctIndex: i as 0 | 1 | 2 | 3 })}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                card.correctIndex === i
                  ? "border-success bg-success text-success-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {card.correctIndex === i ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + i)}
            </button>
            <input
              value={opt}
              onChange={(e) => {
                const opts = [...card.options] as [string, string, string, string];
                opts[i] = e.target.value;
                onChange({ ...card, options: opts });
              }}
              className="flex-1 rounded-lg border border-input bg-background p-2 text-sm"
            />
          </li>
        ))}
      </ul>
      <label className="mt-3 block text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">
          Explicación de la respuesta correcta
        </span>
        <textarea
          value={card.explanation ?? ""}
          onChange={(e) => onChange({ ...card, explanation: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-input bg-background p-2 text-sm"
        />
      </label>
    </div>
  );
}
