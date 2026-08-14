import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Check, Loader2, Trash2 } from "lucide-react";
import { CardImage } from "@/components/CardImage";
import { CARD_BUCKET, removeImages } from "@/lib/card-images";

export function EditCardModal({
  cardId,
  subjectId,
  onClose,
}: {
  cardId: string;
  subjectId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correct, setCorrect] = useState(1);
  const [explanation, setExplanation] = useState("");

  const { data: card, isLoading } = useQuery({
    queryKey: ["flashcard", cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("*")
        .eq("id", cardId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!card) return;
    setQuestion(card.question);
    setOptions([card.option_1, card.option_2, card.option_3, card.option_4]);
    setCorrect(card.correct_option);
    setExplanation(card.explanation ?? "");
  }, [card]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("flashcards")
        .update({
          question: question.trim(),
          option_1: options[0].trim(),
          option_2: options[1].trim(),
          option_3: options[2].trim(),
          option_4: options[3].trim(),
          correct_option: correct,
          explanation: explanation.trim() || null,
        })
        .eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Carta actualizada");
      qc.invalidateQueries({ queryKey: ["subject-cards", subjectId] });
      qc.invalidateQueries({ queryKey: ["flashcard", cardId] });
      onClose();
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const removeImage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("flashcards")
        .update({ image_url: null })
        .eq("id", cardId);
      if (error) throw error;
      await removeImages(CARD_BUCKET, [card?.image_url]);
    },
    onSuccess: () => {
      toast.success("Imagen eliminada");
      qc.invalidateQueries({ queryKey: ["subject-cards", subjectId] });
      qc.invalidateQueries({ queryKey: ["flashcard", cardId] });
    },
    onError: () => toast.error("No se pudo eliminar la imagen"),
  });

  const valid =
    question.trim().length > 0 && options.every((o) => o.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Editar carta</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4">
            {card?.image_url && (
              <div>
                <CardImage
                  value={card.image_url}
                  className="max-h-56 w-full rounded-2xl object-contain"
                />
                <button
                  type="button"
                  onClick={() => removeImage.mutate()}
                  disabled={removeImage.isPending}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-destructive disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Quitar imagen
                </button>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Pregunta</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Opciones (marca la correcta)
              </label>
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrect(i + 1)}
                    aria-label={`Marcar opción ${i + 1} como correcta`}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                      correct === i + 1
                        ? "border-transparent bg-success text-success-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <input
                    value={o}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((p, idx) => (idx === i ? e.target.value : p)),
                      )
                    }
                    className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Explicación (opcional)
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={!valid || save.isPending}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {save.isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
