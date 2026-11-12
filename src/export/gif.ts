import GIF from "gif.js.optimized";
// Vite resolves this to a served URL for the GIF encoder's web worker.
import workerUrl from "gif.js.optimized/dist/gif.worker.js?url";
import type { Renderer } from "../engine/Renderer";
import { renderFrames, type FrameJob } from "./frames";
import { triggerDownload } from "./png";

export interface GifJob extends FrameJob {
  fps: number;
  quality?: number; // lower = better (gif.js convention)
}

export function exportGIF(
  renderer: Renderer,
  job: GifJob,
  onProgress?: (p: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 4,
      quality: job.quality ?? 8,
      workerScript: workerUrl,
      width: job.width,
      height: job.height,
      repeat: 0,
      dither: false,
    });
    const delay = Math.round(1000 / job.fps);

    gif.on("progress", (p: number) => onProgress?.(0.5 + p * 0.5));
    gif.on("finished", (blob: Blob) => {
      triggerDownload(blob, `glass-tile-${Date.now()}.gif`);
      resolve();
    });

    try {
      renderFrames(renderer, job, (canvas, i) => {
        gif.addFrame(canvas, { delay, copy: true });
        onProgress?.((i / job.frames) * 0.5);
      });
      gif.render();
    } catch (err) {
      reject(err);
    }
  });
}
