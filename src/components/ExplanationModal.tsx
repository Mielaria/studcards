import { X, Lightbulb, CheckCircle2 } from "lucide-react";

type ExplanationModalProps = {
  open: boolean;
  onClose: () => void;
  correctAnswer: string;
  explanation: string | null;
  footer?: string;
  variant?: "penalty" | "info";
};

export function ExplanationModal({
  open,
  onClose,
  correctAnswer,
  explanation,
  footer,
  variant = "info",
}: ExplanationModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/15 text-warning">
              <Lightbulb className="h-4 w-4" />
            </div>
            <h3 className="font-display text-lg font-bold sm:text-xl">
              Respuesta correcta
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 sm:p-8">
          <div className="flex items-start gap-3 rounded-2xl bg-success p-4 text-success-foreground shadow-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-base font-bold sm:text-lg">{correctAnswer}</p>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Explicación
            </p>
            <p className="mt-2 whitespace-pre-line text-base font-medium leading-relaxed text-card-foreground sm:text-lg">
              {explanation?.trim() || "Esta carta no tiene explicación guardada."}
            </p>
          </div>

          {footer && (
            <p
              className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${
                variant === "penalty"
                  ? "bg-destructive/10 text-destructive-foreground"
                  : "bg-primary/10 text-primary-foreground"
              }`}
            >
              {footer}
            </p>
          )}
        </div>

        {/* Footer button */}
        <div className="border-t border-border bg-muted/30 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-primary py-3 text-base font-bold text-primary-foreground shadow-elevated transition-transform active:scale-[0.98]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
