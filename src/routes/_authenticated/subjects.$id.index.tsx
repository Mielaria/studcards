import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { toast } from "sonner";
import { exportSubjectBackup, downloadJson } from "@/lib/backup";
import { EditCardModal } from "@/components/EditCardModal";
import { CARD_BUCKET, removeImages } from "@/lib/card-images";


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

  const { data: counts } = useQuery({
    queryKey: ["subject-counts", id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const [total, due, newC, inProgress, learned] = await Promise.all([
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("subject_id", id),
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("subject_id", id)
          .eq("is_learned", false)
          .lte("next_review_at", now),
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("subject_id", id)
          .eq("is_learned", false)
          .eq("correct_answers_count", 0),
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("subject_id", id)
          .eq("is_learned", false)
          .gt("correct_answers_count", 0),
        supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("subject_id", id)
          .eq("is_learned", true),
      ]);
      return {
        total: total.count ?? 0,
        due: due.count ?? 0,
        newC: newC.count ?? 0,
        inProgress: inProgress.count ?? 0,
        learned: learned.count ?? 0,
      };
    },
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

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat icon={<Target className="h-4 w-4" />} label="Para hoy" value={counts?.due ?? 0} accent />
        <MiniStat icon={<BookOpen className="h-4 w-4" />} label="Nuevas" value={counts?.newC ?? 0} />
        <MiniStat icon={<Layers className="h-4 w-4" />} label="En aprendizaje" value={counts?.inProgress ?? 0} />
        <MiniStat icon={<Sparkles className="h-4 w-4" />} label="Aprendidas" value={counts?.learned ?? 0} />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <Link
          to="/subjects/$id/study"
          params={{ id }}
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

      <CardList subjectId={id} />
    </AppShell>
  );
}

function MiniStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          accent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function CardList({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const [editingCard, setEditingCard] = useState<string | null>(null);

  const { data: cards } = useQuery({
    queryKey: ["subject-cards", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, question, is_learned, learning_stage, correct_answers_count")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  if (!cards) return null;
  if (cards.length === 0)
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
        Aún no tienes cartas en esta materia.
      </div>
    );

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg font-semibold">Cartas</h2>
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

