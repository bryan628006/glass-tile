// Raw shader source imports (configured via assetsInclude + the ?raw suffix).
declare module "*.glsl?raw" {
  const src: string;
  export default src;
}
declare module "*.vert?raw" {
  const src: string;
  export default src;
}
declare module "*.frag?raw" {
  const src: string;
  export default src;
}

// gif.js.optimized ships no types. Minimal surface we use.
declare module "gif.js.optimized" {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    workerScript?: string;
    width?: number;
    height?: number;
    repeat?: number;
    background?: string;
    transparent?: number | null;
    dither?: boolean | string;
  }
  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }
  export default class GIF {
    constructor(options?: GIFOptions);
    addFrame(
      image: CanvasImageSource | ImageData,
      opts?: AddFrameOptions
    ): void;
    on(event: "finished", cb: (blob: Blob) => void): void;
    on(event: "progress", cb: (progress: number) => void): void;
    on(event: "abort" | "start", cb: () => void): void;
    render(): void;
    abort(): void;
  }
}
