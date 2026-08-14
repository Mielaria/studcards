// Utility to produce a cropped JPEG (data URL o Blob) from a source image + crop box.
import type { PixelCrop } from "react-image-crop";

function drawCrop(
  image: HTMLImageElement,
  crop: PixelCrop,
  maxWidth: number,
): HTMLCanvasElement {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sx = crop.x * scaleX;
  const sy = crop.y * scaleY;
  const sw = crop.width * scaleX;
  const sh = crop.height * scaleY;

  const targetW = Math.min(maxWidth, sw);
  const scale = targetW / sw;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function getCroppedDataUrl(
  image: HTMLImageElement,
  crop: PixelCrop,
  maxWidth = 1280,
  quality = 0.82,
): Promise<string> {
  return drawCrop(image, crop, maxWidth).toDataURL("image/jpeg", quality);
}

/** Igual que getCroppedDataUrl pero devuelve un Blob listo para subir a Storage. */
export async function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  maxWidth = 1280,
  quality = 0.82,
): Promise<Blob> {
  const canvas = drawCrop(image, crop, maxWidth);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))),
      "image/jpeg",
      quality,
    );
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
