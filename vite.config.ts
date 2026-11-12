import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single-page, fully static build. Shaders are imported as raw strings.
export default defineConfig({
  base: "./",
  plugins: [react()],
  assetsInclude: ["**/*.glsl", "**/*.vert", "**/*.frag"],
  server: {
    // `npm run server` runs the settings backend on :3001; forward API calls to it.
    proxy: { "/api": "http://localhost:3001" },
    watch: {
      // Windows + editors that write atomically (write to a temp file, then
      // rename) slip past chokidar's native events, so the dev server keeps
      // serving a stale transform of a file that has already changed on disk.
      // The failure is silent and confusing — the page renders old code, or
      // throws for a symbol whose import "is" in the source. Polling costs a
      // little idle CPU on a project this size and removes the whole class.
      usePolling: true,
      interval: 400,
      // Polling watches everything it is given, so keep build output and
      // scratch out of it — a single `npm run build` restamps every file in
      // dist at once, which the watcher reads as a bulk change and answers
      // with a full page reload.
      ignored: ["**/dist/**", "**/.vercel/**", "**/.remember/**", "**/*.tmp.*"],
    },
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1200,
  },
});
