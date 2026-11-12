import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { PRESET_ORDER, PRESETS } from "../state/presets";
import { getRenderer } from "../engine/instance";
import { MAX_LOOKS } from "../state/looks";

export function PresetBar() {
  const presetName = useStore((s) => s.presetName);
  const applyPreset = useStore((s) => s.applyPreset);
  const looks = useStore((s) => s.looks);
  const saveLook = useStore((s) => s.saveLook);
  const deleteLook = useStore((s) => s.deleteLook);
  const applyLook = useStore((s) => s.applyLook);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  // Generate a live thumbnail per preset once the renderer exists.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const gen = () => {
      const r = getRenderer();
      // Wait for a measured stage, not just an existing renderer. Thumbnail
      // tile density is derived from cssWidth, so generating before the
      // artboard has been laid out yields one tile the size of the thumbnail.
      if (!r || r.cssWidth <= 1) {
        if (tries++ < 40) setTimeout(gen, 150);
        return;
      }
      try {
        const out: Record<string, string> = {};
        for (const name of PRESET_ORDER) {
          out[name] = r.renderPreview(PRESETS[name], 168, 108);
        }
        if (!cancelled) setThumbs(out);
      } catch {
        if (tries++ < 40) setTimeout(gen, 200); // renderer mid-recreate (StrictMode)
      }
    };
    gen();
    return () => {
      cancelled = true;
    };
  }, []);

  const commitSave = () => {
    const name = draft.trim();
    if (!name) {
      setNaming(false);
      return;
    }
    const r = getRenderer();
    let thumb = "";
    try {
      thumb = r ? r.renderPreview(useStore.getState().config, 168, 108) : "";
    } catch {
      thumb = "";
    }
    saveLook(name, thumb);
    setDraft("");
    setNaming(false);
  };

  return (
    <>
      <div className="presets" role="group" aria-label="Presets">
        {PRESET_ORDER.map((name, i) => (
          <button
            key={name}
            type="button"
            className="preset"
            data-on={presetName === name}
            onClick={() => applyPreset(name)}
            title={`${name} (press ${i + 1})`}
          >
            {thumbs[name] && (
              <img className="preset-thumb" src={thumbs[name]} alt="" draggable={false} />
            )}
            <span className="preset-name">{name}</span>
            <kbd className="preset-kbd">{i + 1}</kbd>
          </button>
        ))}
      </div>

      {looks.length > 0 && (
        <div className="presets" role="group" aria-label="Saved looks">
          {looks.map((l) => (
            <div key={l.name} className="preset preset-saved">
              <button
                type="button"
                className="preset-open"
                onClick={() => applyLook(l.name)}
                aria-label={`Apply ${l.name}`}
                title={`Apply ${l.name}`}
              >
                {l.thumb && (
                  <img className="preset-thumb" src={l.thumb} alt="" draggable={false} />
                )}
                <span className="preset-name">{l.name}</span>
              </button>
              <button
                type="button"
                className="preset-del"
                onClick={() => deleteLook(l.name)}
                aria-label={`Delete ${l.name}`}
                title={`Delete ${l.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {naming ? (
        <div className="save-row">
          <input
            className="save-input"
            autoFocus
            value={draft}
            placeholder="Name this look"
            maxLength={28}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSave();
              if (e.key === "Escape") {
                setDraft("");
                setNaming(false);
              }
            }}
          />
          <button type="button" className="btn-quiet" onClick={commitSave}>
            Save
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn-quiet btn-wide"
          disabled={looks.length >= MAX_LOOKS}
          title={
            looks.length >= MAX_LOOKS
              ? `Delete a look first — ${MAX_LOOKS} is the limit`
              : "Save the current settings as a reusable look"
          }
          onClick={() => setNaming(true)}
        >
          Save current look
        </button>
      )}
    </>
  );
}
