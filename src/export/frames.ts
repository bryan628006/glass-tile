import type { Renderer } from "../engine/Renderer";
import { pathAt, type PathShape } from "./cursorPath";
import { pixelsToImageData } from "./png";

export interface FrameJob {
  width: number;
  height: number;
  frames: number;
  loopSeconds: number;
  shape: PathShape;
  transparent?: boolean;
}

/** Render each deterministic frame of one loop into a reusable 2D canvas. */
export function renderFrames(
  renderer: Renderer,
  job: FrameJob,
  onFrame: (canvas: HTMLCanvasElement, index: number) => void
) {
  const canvas = document.createElement("canvas");
  canvas.width = job.width;
  canvas.height = job.height;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < job.frames; i++) {
    const t = i / job.frames;
    const bend = pathAt(t, job.shape);
    const { pixels } = renderer.renderOffscreen(job.width, job.height, {
      bend,
      time: t * job.loopSeconds,
      transparent: job.transparent,
    });
    ctx.putImageData(pixelsToImageData(pixels, job.width, job.height), 0, 0);
    onFrame(canvas, i);
  }
}
