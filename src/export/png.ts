import type { Renderer } from "../engine/Renderer";

/** Build an ImageData from a raw RGBA buffer (avoids SharedArrayBuffer typing). */
export function pixelsToImageData(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): ImageData {
  const img = new ImageData(width, height);
  img.data.set(pixels);
  return img;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render to a PNG blob. Shared by download and clipboard. */
async function renderPngBlob(
  renderer: Renderer,
  width: number,
  height: number,
  transparent: boolean
): Promise<Blob> {
  const { pixels } = renderer.renderOffscreen(width, height, { transparent });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(pixelsToImageData(pixels, width, height), 0, 0);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

/**
 * Copy straight to the clipboard. Designers move these into Figma, Slack and
 * decks far more often than they keep the file, so the round trip through the
 * downloads folder is pure friction.
 */
export async function copyPNG(
  renderer: Renderer,
  width: number,
  height: number,
  transparent: boolean
): Promise<void> {
  const blob = await renderPngBlob(renderer, width, height, transparent);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function exportPNG(
  renderer: Renderer,
  width: number,
  height: number,
  transparent: boolean,
  name = `glass-tile-${Date.now()}.png`
) {
  const blob = await renderPngBlob(renderer, width, height, transparent);
  triggerDownload(blob, name);
}

export { triggerDownload };
