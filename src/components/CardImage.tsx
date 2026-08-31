import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { CARD_BUCKET, getImageUrl } from "@/lib/card-images";

/** Hook: resuelve un valor de image_url (ruta de Storage, data URL o http) a una URL mostrable. */
export function useImageUrl(bucket: string, value?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!value) {
      setUrl(null);
      return;
    }
    getImageUrl(bucket, value).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [bucket, value]);
  return url;
}

export function CardImage({
  value,
  alt = "Imagen de la carta",
  className,
  bucket = CARD_BUCKET,
  expandable = false,
}: {
  value?: string | null;
  alt?: string;
  className?: string;
  bucket?: string;
  /** Muestra un botón para ver la imagen a pantalla completa. */
  expandable?: boolean;
}) {
  const url = useImageUrl(bucket, value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!value) return null;
  if (!url) return <div className={`animate-pulse bg-muted ${className ?? ""}`} />;
  const img = <img src={url} alt={alt} className={className} loading="lazy" />;
  if (!expandable) return img;

  return (
    <div className="relative">
      {img}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver imagen a pantalla completa"
        className="absolute right-2 top-2 rounded-full bg-foreground/60 p-2 text-background backdrop-blur transition-colors hover:bg-foreground/80"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
      {open && <Lightbox url={url} alt={alt} onClose={() => setOpen(false)} />}
    </div>
  );
}

const ZOOM = 2.75;

/** Visor a pantalla completa con lupa: clic sobre la imagen amplía ese punto. */
function Lightbox({
  url,
  alt,
  onClose,
}: {
  url: string;
  alt: string;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  const onImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (zoomed) {
      setZoomed(false);
    } else {
      setOrigin({ x, y });
      setZoomed(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-foreground/90 p-4"
    >
      <img
        src={url}
        alt={alt}
        onClick={onImageClick}
        onMouseMove={(e) => {
          if (!zoomed) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setOrigin({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
          });
        }}
        style={{
          transform: `scale(${zoomed ? ZOOM : 1})`,
          transformOrigin: `${origin.x}% ${origin.y}%`,
        }}
        className={`max-h-full max-w-full object-contain transition-transform duration-200 ${
          zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
        }`}
      />
      <span className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-3 py-1 text-xs text-foreground">
        {zoomed ? "Toca la imagen para alejar" : "Toca la imagen para acercar"}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar imagen"
        className="absolute right-4 top-4 rounded-full bg-background/90 p-2 text-foreground"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

