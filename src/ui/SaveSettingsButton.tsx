import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import { loadSettings, saveSettings } from "../state/settingsApi";

type Status = "idle" | "saving" | "server" | "browser" | "error";

const LABEL: Record<Status, string> = {
  idle: "Save settings",
  saving: "Saving…",
  server: "Saved",
  browser: "Saved in browser",
  error: "Save failed",
};

/** Saves the current tile settings to the local backend and restores them on load. */
export function SaveSettingsButton() {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<number>();

  // Restore whatever was saved last time.
  useEffect(() => {
    let cancelled = false;
    loadSettings().then((saved) => {
      if (saved && !cancelled) useStore.getState().applySettings(saved);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, []);

  const onSave = async () => {
    clearTimeout(timer.current);
    setStatus("saving");
    try {
      setStatus(await saveSettings(useStore.getState().config));
    } catch {
      setStatus("error");
    }
    timer.current = window.setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <button
      type="button"
      className="btn-ghost btn-save"
      data-status={status}
      onClick={onSave}
      disabled={status === "saving"}
      title="Save the current settings so they come back next time"
      aria-live="polite"
    >
      {LABEL[status]}
    </button>
  );
}
