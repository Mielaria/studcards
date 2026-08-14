import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Plus, BookOpen, ChevronRight, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subjects/")({
  head: () => ({
    meta: [
      { title: "Materias — StudCards" },
      { name: "description", content: "Tus materias de estudio en StudCards." },
    ],
  }),
  component: SubjectsPage,
});

interface SubjectWithCounts {
  id: string;
  name: string;
  icon: string;
  total: number;
  due: number;
  learned: number;
}

function SubjectsPage() {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const qc = useQueryClient();

  const capitalizeFirst = (value: string) => {
    const trimmed = value.replace(/^\s+/, "");
    if (!trimmed) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["subjects-with-counts"],
    queryFn: async (): Promise<SubjectWithCounts[]> => {
      const { data: subs, error } = await supabase
        .from("subjects")
        .select("id, name, icon")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const now = new Date().toISOString();
      const results = await Promise.all(
        (subs ?? []).map(async (s) => {
          const [total, due, learned] = await Promise.all([
            supabase
              .from("flashcards")
              .select("id", { count: "exact", head: true })
              .eq("subject_id", s.id),
            supabase
              .from("flashcards")
              .select("id", { count: "exact", head: true })
              .eq("subject_id", s.id)
              .eq("is_learned", false)
              .lte("next_review_at", now),
            supabase
              .from("flashcards")
              .select("id", { count: "exact", head: true })
              .eq("subject_id", s.id)
              .eq("is_learned", true),
          ]);
          return {
            ...s,
            total: total.count ?? 0,
            due: due.count ?? 0,
            learned: learned.count ?? 0,
          };
        }),
      );
      return results;
    },
  });

  const createSubject = useMutation({
    mutationFn: async (name: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No auth");
      const { error } = await supabase
        .from("subjects")
        .insert({ user_id: user.id, name: name.trim(), icon: "book" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Materia creada");
      setNewName("");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["subjects-with-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSubject = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("subjects")
        .update({ name: name.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Materia actualizada");
      setEditingId(null);
      setEditName("");
      qc.invalidateQueries({ queryKey: ["subjects-with-counts"] });
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  return (
    <AppShell>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Mis materias</h1>
          <p className="text-sm text-muted-foreground">Elige una para estudiar o crear cartas</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="hidden h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated md:flex"
          aria-label="Crear materia"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {creating && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Nombre de la materia</span>
            <input
              value={newName}
              onChange={(e) => setNewName(capitalizeFirst(e.target.value))}
              placeholder="Ej: Geografía"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-primary/40 focus:ring-2"
              autoFocus
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => newName.trim() && createSubject.mutate(newName)}
              disabled={!newName.trim() || createSubject.isPending}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Crear
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="rounded-full border border-border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <ul className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3">
          {subjects?.map((s) =>
            editingId === s.id ? (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-card"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(capitalizeFirst(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editName.trim()) {
                        updateSubject.mutate({ id: s.id, name: editName });
                      }
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditName("");
                      }
                    }}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
                    autoFocus
                  />
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() =>
                      editName.trim() && updateSubject.mutate({ id: s.id, name: editName })
                    }
                    disabled={!editName.trim() || updateSubject.isPending}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
                    aria-label="Guardar"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditName("");
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
                    aria-label="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ) : (
              <li key={s.id}>
                <Link
                  to="/subjects/$id"
                  params={{ id: s.id }}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.total} cartas · {s.due} para hoy · {s.learned} aprendidas
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingId(s.id);
                      setEditName(s.name);
                    }}
                    className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                </Link>
              </li>
            )
          )}
          {!creating && (
            <li>
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-transparent p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary md:hidden"
              >
                <Plus className="h-4 w-4" /> Nueva materia
              </button>
            </li>
          )}
        </ul>
      )}
    </AppShell>
  );
}
