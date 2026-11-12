import { useEffect, useRef } from "react";
import { Renderer } from "../engine/Renderer";
import { setRenderer } from "../engine/instance";

interface StageProps {
  /** Reported once if WebGL2 is unavailable; the frame renders the message. */
  onError: (message: string) => void;
}

/** The canvas itself. Sized by its parent (the artboard), not by the window. */
export function Stage({ onError }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer(canvas);
    } catch (e) {
      onErrorRef.current(e instanceof Error ? e.message : "WebGL2 is not available.");
      return;
    }
    setRenderer(renderer);
    renderer.resize();
    renderer.start();

    const ro = new ResizeObserver(() => renderer.resize());
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      renderer.setPointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, true);
    };
    const onLeave = () => renderer.setPointer(0.5, 0.5, false);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      setRenderer(null);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="stage-canvas" />;
}
