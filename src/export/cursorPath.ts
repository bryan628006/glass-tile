// A seamless looping path for animated export and the "drift" preview.
// Returns a bend vector in roughly -1..1, matching the cursor-bend space.

export type PathShape = "ellipse" | "figure8" | "drift";

export function pathAt(t: number, shape: PathShape = "ellipse"): [number, number] {
  const a = t * Math.PI * 2;
  switch (shape) {
    case "figure8":
      return [Math.sin(a), Math.sin(a * 2) * 0.5];
    case "drift":
      // gentle wandering, still loops cleanly
      return [Math.sin(a) * 0.7 + Math.sin(a * 2) * 0.15, Math.cos(a) * 0.45];
    case "ellipse":
    default:
      return [Math.sin(a), Math.cos(a) * 0.6];
  }
}
