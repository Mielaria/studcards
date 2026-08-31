import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { getFontSize, setFontSize, type FontSize } from "@/lib/font-pref";

/** Preferencia de tamaño de texto de la sesión (persistida en el dispositivo). */
export function useFontSizePref() {
  const [size, setSize] = useState<FontSize>("md");
  useEffect(() => setSize(getFontSize()), []);
  const change = useCallback((s: FontSize) => {
    setSize(s);
    setFontSize(s);
  }, []);
  return { size, change };
}

/** Modo inmersivo: pantalla completa del navegador + oculta navegación y scrollbar. */
export function useImmersive() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const on = !!document.fullscreenElement;
      setActive(on);
      document.body.classList.toggle("immersive", on);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.body.classList.remove("immersive");
    };
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Si el navegador no permite pantalla completa, al menos ocultamos la navegación.
      setActive((a) => {
        document.body.classList.toggle("immersive", !a);
        return !a;
      });
    }
  }, []);

  return { active, toggle };
}

export function ImmersiveButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const Icon = active ? Minimize : Maximize;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Salir de pantalla completa" : "Pantalla completa"}
      title={active ? "Salir de pantalla completa" : "Pantalla completa"}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function FontSizeButtons({
  value,
  onChange,
}: {
  value: FontSize;
  onChange: (s: FontSize) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5"
      role="group"
      aria-label="Tamaño del texto"
    >
      {(["sm", "md", "lg"] as FontSize[]).map((size, i) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          aria-pressed={value === size}
          aria-label={`Texto ${["pequeño", "mediano", "grande"][i]}`}
          title={`Texto ${["pequeño", "mediano", "grande"][i]}`}
          className={`flex h-7 w-7 items-center justify-center rounded-full font-display font-bold leading-none transition-colors ${
            ["text-[0.65rem]", "text-sm", "text-base"][i]
          } ${
            value === size
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          A
        </button>
      ))}
    </div>
  );
}
