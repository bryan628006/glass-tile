// Rasterize an SVG at high DPI so vector edges stay crisp as the field.

const MAX_DIM = 2400; // cap the long edge to keep textures sane

function parseIntrinsicSize(svgText: string): { w: number; h: number } {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  const wAttr = parseFloat(svg.getAttribute("width") || "");
  const hAttr = parseFloat(svg.getAttribute("height") || "");
  if (wAttr > 0 && hAttr > 0) return { w: wAttr, h: hAttr };
  const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
  return { w: 1024, h: 1024 };
}

export async function rasterizeSvg(file: File): Promise<ImageBitmap> {
  const text = await file.text();
  const { w, h } = parseIntrinsicSize(text);

  // High-DPI: render at ~2x device scale, capped to MAX_DIM.
  const scale = Math.min((window.devicePixelRatio || 1) * 2, MAX_DIM / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const blob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, tw, th);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
