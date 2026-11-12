import type { Renderer } from "./Renderer";

// Single live renderer instance, set by Stage, read by the export panel.
let instance: Renderer | null = null;
export const setRenderer = (r: Renderer | null) => {
  instance = r;
};
export const getRenderer = () => instance;
