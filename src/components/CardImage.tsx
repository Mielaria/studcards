import { useEffect, useState } from "react";
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
}: {
  value?: string | null;
  alt?: string;
  className?: string;
  bucket?: string;
}) {
  const url = useImageUrl(bucket, value);
  if (!value) return null;
  if (!url) return <div className={`animate-pulse bg-muted ${className ?? ""}`} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}