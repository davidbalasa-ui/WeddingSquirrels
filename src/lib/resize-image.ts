/**
 * Downscale an image file to a small JPEG data URL before it is sent to a
 * server action. This keeps contact photos well under the 1 MB action body
 * limit and small enough to store comfortably in Postgres.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 400,
  quality = 0.8,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("NOT_IMAGE");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("CANVAS_UNAVAILABLE");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}
