import { rasterizeSvg } from "./rasterizeSvg";

export const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp,.svg";

function isSvg(file: File) {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

/** Decode any accepted file into an ImageBitmap (SVG rasterized at high DPI). */
export async function loadImageFile(file: File): Promise<ImageBitmap> {
  if (isSvg(file)) return rasterizeSvg(file);
  // PNG / JPG / WEBP — fast path via the browser decoder.
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback for browsers without options support.
    return await createImageBitmap(file);
  }
}

export function isAccepted(file: File): boolean {
  return ACCEPTED.includes(file.type) || isSvg(file) || /\.(png|jpe?g|webp)$/i.test(file.name);
}
