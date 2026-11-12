import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { useStore } from "./state/store";
import "./styles/global.css";
import "./styles/shell.css";
import "./styles/controls.css";

// Dev-only handle so the config can be driven from a test harness or the
// console. Stripped from production builds by the import.meta.env guard.
if (import.meta.env.DEV) {
  (window as unknown as { __glassTile: unknown }).__glassTile = { useStore };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
