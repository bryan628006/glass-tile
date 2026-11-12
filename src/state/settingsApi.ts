import type { Config } from "./types";

/**
 * Talks to the local backend in /server. When the backend isn't reachable
 * (e.g. the static GitHub Pages build), settings fall back to localStorage so
 * the button still does something useful.
 */

// Override with VITE_API_URL at build time to point at a hosted backend.
const API = `${import.meta.env.VITE_API_URL ?? ""}/api/settings`;
const LOCAL_KEY = "glasstile.settings";

export type SaveTarget = "server" | "browser";

async function request(init?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(API, { ...init, signal: AbortSignal.timeout(3000) });
    // A static host answers with an HTML 404 page; treat anything but JSON as "no backend".
    const isJson = res.headers.get("content-type")?.includes("application/json");
    return res.ok && isJson ? res : null;
  } catch {
    return null;
  }
}

export async function saveSettings(config: Config): Promise<SaveTarget> {
  const res = await request({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (res) return "server";

  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(config));
  } catch {
    throw new Error("Could not save settings");
  }
  return "browser";
}

export async function loadSettings(): Promise<Partial<Config> | null> {
  const res = await request();
  if (res) {
    const body = (await res.json()) as { settings: Partial<Config> | null };
    if (body.settings) return body.settings;
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Partial<Config>) : null;
  } catch {
    return null;
  }
}
