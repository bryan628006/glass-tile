import type { Config } from "./types";

/**
 * User-saved looks, persisted locally.
 *
 * Consistency across assets is the whole point of a brand tool: the four
 * built-ins are starting points, but the look a team actually ships has to
 * survive a reload. Nothing leaves the browser, in keeping with the rest of
 * the app.
 */
export interface SavedLook {
  name: string;
  config: Config;
  /** Small PNG data URL, so the picker stays visual. */
  thumb: string;
}

const KEY = "glasstile.looks";

/** Keeps localStorage well clear of its quota with thumbnails attached. */
export const MAX_LOOKS = 12;

export function loadLooks(): SavedLook[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is SavedLook =>
        !!l && typeof l.name === "string" && typeof l.config === "object"
    );
  } catch {
    return []; // blocked storage or corrupt entry: start clean rather than throw
  }
}

export function persistLooks(looks: SavedLook[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(looks));
  } catch {
    // Quota or private mode. The look still applies for this session.
  }
}
