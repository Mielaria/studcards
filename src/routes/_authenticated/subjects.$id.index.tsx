import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  ArrowLeft,
  Play,
  Plus,
  Trash2,
  Pencil,
  BookOpen,
  Sparkles,
  Target,
  Layers,
  Download,
  AlertTriangle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { exportSubjectBackup, downloadJson } from "@/lib/backup";
import { EditCardModal } from "@/components/EditCardModal";
import { CARD_BUCKET, removeImages } from "@/lib/card-images";
import { fetchStateCounts } from "@/lib/card-state";
import { useOfficialDay } from "@/hooks/useOfficialDay";
import { useWrittenEnabled } from "@/lib/written-pref";
import { useAudioOnly } from "@/lib/audio-pref";


export const Route = createFileRoute("/_authenticated/subjects/$id/")({
  head: () => ({
    meta: [{ title: "Materia — StudCards" }],
  }),
  component: SubjectDetail,
});

function SubjectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: subject } = useQuery({
    queryKey: ["subject", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const dayKeyNow = useOfficialDay();

  // Contadores calculados en servidor (RPC get_card_state_counts) con
  // fallback automático si la RPC aún no existe.
  const { data: counts } = useQuery({
    queryKey: ["subject-counts", id, dayKeyNow],
    queryFn: () => fetchStateCounts(id),
  });

  const updateSubject = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from("subjects")
        .update({ name: newName.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Materia actualizada");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["subject", id] });
      qc.invalidateQueries({ queryKey: ["subjects-with-counts"] });
    },
  });

  const deleteSubject = useMutation({
    mutationFn: async () => {
      // Borra primero las imágenes de Storage de todas las cartas de la materia.
      const { data: imgs } = await supabase
        .from("flashcards")
        .select("image_url")
        .eq("subject_id", id);
      await removeImages(CARD_BUCKET, (imgs ?? []).map((c) => c.image_url));
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Materia eliminada");
      qc.invalidateQueries({ queryKey: ["subjects-with-counts"] });
      navigate({ to: "/subjects" });
    },
  });

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          to="/subjects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Materias
        </Link>
      </div>

      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={subject?.name}
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-lg font-display font-semibold"
              />
              <button
                onClick={() => name.trim() && updateSubject.mutate(name)}
                className="rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setName("");
                }}
                className="rounded-full border border-border px-4 text-sm"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-semibold">{subject?.name}</h1>
              <p className="text-sm text-muted-foreground">
                {counts?.total ?? 0} cartas en total
              </p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(true);
                setName(subject?.name ?? "");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-destructive"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">
              Eliminar “{subject?.name}”
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Se borrarán {counts?.total ?? 0} cartas de esta materia. Puedes
              descargar una copia en JSON antes de continuar.
            </p>
            <button
              onClick={async () => {
                try {
                  setDownloading(true);
                  const data = await exportSubjectBackup(id);
                  const slug = (subject?.name ?? "materia")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");
                  downloadJson(
                    data,
                    `studcards-${slug}-${new Date().toISOString().slice(0, 10)}.json`,
                  );
                  toast.success("JSON descargado");
                } catch {
                  toast.error("No se pudo exportar");
                } finally {
                  setDownloading(false);
                }
              }}
              disabled={downloading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Generando…" : "Descargar JSON de esta materia"}
            </button>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  deleteSubject.mutate();
                }}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MiniStat icon={<Target className="h-4 w-4" />} label="Para hoy" value={counts?.due ?? 0} accent />
        <MiniStat icon={<BookOpen className="h-4 w-4" />} label="Nuevas" value={counts?.new ?? 0} />
        <MiniStat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Falladas"
          value={counts?.failed ?? 0}
          danger
        />
        <MiniStat icon={<Layers className="h-4 w-4" />} label="En aprendizaje" value={counts?.learning ?? 0} />
        <MiniStat icon={<Sparkles className="h-4 w-4" />} label="Aprendidas" value={counts?.learned ?? 0} success />
        <MiniStat icon={<Layers className="h-4 w-4" />} label="Totales" value={counts?.total ?? 0} />
      </section>

      {(counts?.failed ?? 0) > 0 && (
        <Link
          to="/subjects/$id/study"
          params={{ id }}
          search={{ mode: "failed" }}
          className="mt-4 flex items-center justify-between rounded-2xl border border-destructive/40 bg-destructive/10 p-4"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <h3 className="font-display text-base font-semibold text-destructive">
                Repasar falladas
              </h3>
              <p className="text-xs text-muted-foreground">
                {counts?.failed} carta{counts?.failed === 1 ? "" : "s"} que respondiste mal
              </p>
            </div>
          </div>
          <Play className="h-5 w-5 text-destructive" />
        </Link>
      )}

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <Link
          to="/subjects/$id/study"
          params={{ id }}
          search={{ mode: "all" as const }}
          className="flex items-center justify-between rounded-2xl bg-primary p-5 text-primary-foreground shadow-elevated"
        >
          <div>
            <h3 className="font-display text-lg font-semibold">Estudiar</h3>
            <p className="text-sm opacity-90">Empieza una sesión de esta materia</p>
          </div>
          <Play className="h-6 w-6" />
        </Link>
        <Link
          to="/create"
          search={{ subject: id }}
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-card"
        >
          <div>
            <h3 className="font-display text-lg font-semibold">Crear carta</h3>
            <p className="text-sm text-muted-foreground">Manual, con 4 opciones</p>
          </div>
          <Plus className="h-6 w-6 text-primary" />
        </Link>
      </section>

      <WrittenToggle subjectId={id} />

      <CardList subjectId={id} />
    </AppShell>
  );
}

function MiniStat({
  icon,
  label,
  value,
  accent,
  danger,
  success,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
  success?: boolean;
}) {
  const toneClass = danger
    ? "bg-destructive text-destructive-foreground"
    : accent
      ? "bg-primary text-primary-foreground"
      : success
        ? "bg-success text-success-foreground"
        : "bg-muted text-muted-foreground";
  const display = Math.min(Math.max(value, 0), 99999).toLocaleString("es-CO");
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 shadow-card ${
        danger ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
      }`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
        {icon}
      </div>
      <div
        className="mt-3 font-display text-xl font-semibold tabular-nums leading-tight tracking-tight sm:text-2xl"
        title={String(value)}
      >
        {display}
      </div>
      <div className="truncate text-xs text-muted-foreground" title={label}>
        {label}
      </div>
    </div>
  );
}

function WrittenToggle({ subjectId }: { subjectId: string }) {
  const { enabled, toggle } = useWrittenEnabled(subjectId);
  const audio = useAudioOnly(subjectId);
  return (
    <>
    <section className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold">Respuesta escrita</h3>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Algunas preguntas pedirán escribir la respuesta (aleatorio)."
            : "Todas las preguntas serán de opción múltiple."}
        </p>
      </div>
      <button
        onClick={toggle}
        role="switch"
        aria-checked={enabled}
        aria-label="Activar respuesta escrita"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-all ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </section>
    <section className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold">Usar únicamente audio</h3>
        <p className="text-xs text-muted-foreground">
          {audio.enabled
            ? "Todas las preguntas se responden hablando en inglés por micrófono."
            : "Desactivado: se usa opción múltiple / respuesta escrita."}
        </p>
      </div>
      <button
        onClick={audio.toggle}
        role="switch"
        aria-checked={audio.enabled}
        aria-label="Usar únicamente audio"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          audio.enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-all ${
            audio.enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </section>
    </>
  );
}

const CARD_PAGE = 50;

function CardList({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");


  // Búsqueda y paginación en servidor: nunca se descargan miles de filas.
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["subject-cards", subjectId, debounced],
      initialPageParam: 0,
      queryFn: async ({ pageParam }) => {
        // Insensible a mayúsculas (ilike) y a tildes: cada letra acentuable se
        // sustituye por "_", que coincide con cualquier carácter.
        const pattern = debounced
          .replace(/[%_\\]/g, "")
          .replace(/[aáàäâeéèëêiíìïîoóòöôuúùüûnñcçyý]/gi, "_");
        let q = supabase
          .from("flashcards")
          .select("id, question, is_learned, learning_stage, correct_answers_count")
          .eq("subject_id", subjectId)
          .order("created_at", { ascending: false })
          .range(pageParam, pageParam + CARD_PAGE - 1);
        if (pattern)
          q = q.or(
            ["question", "option_1", "option_2", "option_3", "option_4"]
              .map((c) => `${c}.ilike.%${pattern}%`)
              .join(","),
          );
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      },

      getNextPageParam: (last, pages) =>
        last.length === CARD_PAGE ? pages.length * CARD_PAGE : undefined,
    });

  const cards = data?.pages.flat() ?? [];

  const delCard = useMutation({
    mutationFn: async (id: string) => {
      const { data: card } = await supabase
        .from("flashcards")
        .select("image_url")
        .eq("id", id)
        .maybeSingle();
      const { error } = await supabase.from("flashcards").delete().eq("id", id);
      if (error) throw error;
      await removeImages(CARD_BUCKET, [card?.image_url]);
    },
    onSuccess: () => {
      toast.success("Carta eliminada");
      qc.invalidateQueries({ queryKey: ["subject-cards", subjectId] });
      qc.invalidateQueries({ queryKey: ["subject-counts", subjectId] });
    },
  });

  if (!data) return null;
  if (cards.length === 0 && !debounced)
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
        Aún no tienes cartas en esta materia.
      </div>
    );

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Cartas</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(search.trim());
          }}
          className="flex w-full gap-2 sm:w-auto"
        >
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar carta por nombre…"
              aria-label="Buscar carta"
              className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Buscar
          </button>
          {debounced && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDebounced("");
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              Limpiar
            </button>
          )}
        </form>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/60 p-4 text-center text-sm text-muted-foreground">
          Sin resultados para “{debounced}”.
        </p>
      ) : (
      <ul className="grid gap-2">
        {cards.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2">{c.question}</p>
              <p className="text-xs text-muted-foreground">
                {c.is_learned
                  ? "Aprendida"
                  : `Etapa ${c.learning_stage}`}{" "}
                · {c.correct_answers_count} aciertos
              </p>
            </div>
            <button
              onClick={() => setEditingCard(c.id)}
              className="text-muted-foreground hover:text-primary"
              aria-label="Editar carta"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (confirm("¿Eliminar esta carta?")) delCard.mutate(c.id);
              }}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      )}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-3 w-full rounded-xl border border-border bg-card py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {isFetchingNextPage ? "Cargando…" : "Cargar más"}
        </button>
      )}
      {editingCard && (
        <EditCardModal
          cardId={editingCard}
          subjectId={subjectId}
          onClose={() => setEditingCard(null)}
        />
      )}
    </section>
  );
}

