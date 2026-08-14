// Helpers de imágenes en Supabase Storage.
// Las rutas guardadas en la BD tienen la forma "<user_id>/<uuid>.jpg".
// Compatibilidad: los valores antiguos en base64 (data:) o URLs http se
// devuelven tal cual para que las cartas viejas sigan funcionando.
import { supabase } from "@/integrations/supabase/client";

export const CARD_BUCKET = "card-images";
export const AVATAR_BUCKET = "avatars";

export function isDataUrl(value?: string | null): boolean {
  return !!value && value.startsWith("data:");
}

export function isStoragePath(value?: string | null): boolean {
  return !!value && !value.startsWith("data:") && !/^https?:\/\//.test(value);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("No se pudo leer la imagen"));
    r.readAsDataURL(blob);
  });
}

function extFor(blob: Blob): string {
  if (blob.type === "image/png") return "png";
  if (blob.type === "image/webp") return "webp";
  return "jpg";
}

/** Sube un blob al bucket dentro de la carpeta del usuario y devuelve la ruta. */
export async function uploadImageBlob(
  bucket: string,
  blob: Blob,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión");
  const path = `${user.id}/${crypto.randomUUID()}.${extFor(blob)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Sube una imagen recibida como data URL y devuelve la ruta en Storage. */
export async function uploadDataUrl(
  bucket: string,
  dataUrl: string,
): Promise<string> {
  return uploadImageBlob(bucket, await dataUrlToBlob(dataUrl));
}

/** Borra archivos del bucket; ignora valores que no sean rutas de Storage. */
export async function removeImages(
  bucket: string,
  values: (string | null | undefined)[],
): Promise<void> {
  const paths = values.filter((v): v is string => isStoragePath(v));
  if (paths.length === 0) return;
  await supabase.storage.from(bucket).remove(paths);
}

const signedCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_TTL_SECONDS = 3600;

/** Devuelve una URL mostrable (firmada si es una ruta de Storage). */
export async function getImageUrl(
  bucket: string,
  value?: string | null,
): Promise<string | null> {
  if (!value) return null;
  if (!isStoragePath(value)) return value;
  const key = `${bucket}/${value}`;
  const cached = signedCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(value, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  signedCache.set(key, {
    url: data.signedUrl,
    expiresAt: Date.now() + (SIGNED_TTL_SECONDS - 60) * 1000,
  });
  return data.signedUrl;
}

/** Descarga un archivo de Storage y lo devuelve como data URL (para exportar). */
export async function downloadAsDataUrl(
  bucket: string,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return blobToDataUrl(data);
}