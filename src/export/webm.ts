import type { Renderer } from "../engine/Renderer";
import { pathAt, type PathShape } from "./cursorPath";
import { triggerDownload, pixelsToImageData } from "./png";

export interface VideoJob {
  width: number;
  height: number;
  fps: number;
  loopSeconds: number;
  shape: PathShape;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Best available recorder mime: prefer MP4 (Safari), else WebM (VP9/VP8). */
export function pickVideoMime(): { mime: string; ext: string } {
  const candidates = [
    { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) {
      return c;
    }
  }
  return { mime: "video/webm", ext: "webm" };
}

export async function exportVideo(
  renderer: Renderer,
  job: VideoJob,
  onProgress?: (p: number) => void
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = job.width;
  canvas.height = job.height;
  const ctx = canvas.getContext("2d")!;

  const { mime, ext } = pickVideoMime();
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  // Resolution-aware bitrate (~0.18 bits/pixel/frame) so detail stays crisp.
  const bitrate = Math.round(
    Math.min(40_000_000, Math.max(8_000_000, job.width * job.height * job.fps * 0.18))
  );
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start();

  const frames = Math.max(1, Math.round(job.fps * job.loopSeconds));
  const interval = 1000 / job.fps;
  for (let i = 0; i < frames; i++) {
    const frameStart = performance.now();
    const t = i / frames;
    const bend = pathAt(t, job.shape);
    const { pixels } = renderer.renderOffscreen(job.width, job.height, {
      bend,
      time: t * job.loopSeconds,
    });
    ctx.putImageData(pixelsToImageData(pixels, job.width, job.height), 0, 0);
    track.requestFrame?.();
    onProgress?.((i + 1) / frames);
    // Pace toward real time: only sleep the slice the render didn't consume.
    await sleep(Math.max(0, interval - (performance.now() - frameStart)));
  }
  // Hold the final frame briefly so the loop closes cleanly.
  track.requestFrame?.();
  await sleep(interval);

  rec.stop();
  await stopped;
  triggerDownload(new Blob(chunks, { type: mime.split(";")[0] }), `glass-tile-${Date.now()}.${ext}`);
}
