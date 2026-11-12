// Glass Tile — tiny local backend for saving settings.
//
// No dependencies: just Node's built-in http + fs.
//
//   GET  /api/settings   -> { settings, savedAt }   (settings is null if nothing saved yet)
//   POST /api/settings   -> body is the settings JSON; writes it to server/data/settings.json
//
// It also serves the built app from ../dist, so `npm start` gives you the
// whole thing on one port: http://localhost:3001

import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(here, "data");
const DATA_FILE = path.join(DATA_DIR, "settings.json");
const DIST = path.resolve(here, "..", "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    // Lets the Vite dev server (another port) call this API too.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) reject(new Error("Body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handleApi(req, res) {
  if (req.method === "GET") {
    if (!existsSync(DATA_FILE)) return send(res, 200, { settings: null, savedAt: null });
    const saved = JSON.parse(await readFile(DATA_FILE, "utf8"));
    return send(res, 200, saved);
  }

  if (req.method === "POST") {
    let settings;
    try {
      settings = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { error: "Body must be valid JSON" });
    }
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return send(res, 400, { error: "Settings must be a JSON object" });
    }
    const record = { settings, savedAt: new Date().toISOString() };
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(record, null, 2));
    console.log(`Saved settings at ${record.savedAt}`);
    return send(res, 200, record);
  }

  return send(res, 405, { error: "Method not allowed" });
}

async function serveStatic(req, res) {
  if (!existsSync(DIST)) {
    return send(res, 200, "API is running. Run `npm run build` to serve the app here too.", "text/plain");
  }
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(DIST, urlPath);
  // Stay inside dist, and fall back to index.html for unknown paths.
  if (!file.startsWith(DIST) || !existsSync(file) || urlPath === "/") {
    file = path.join(DIST, "index.html");
  }
  const type = TYPES[path.extname(file)] || "application/octet-stream";
  send(res, 200, await readFile(file), type);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204, "", "text/plain");
    if (req.url.startsWith("/api/settings")) return await handleApi(req, res);
    return await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Glass Tile backend running at http://localhost:${PORT}`);
  console.log(`Settings file: ${DATA_FILE}`);
});
