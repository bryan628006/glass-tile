import { useRef, useState } from "react";
import { useStore } from "../state/store";
import { loadImageFile, isAccepted, ACCEPT_ATTR } from "../engine/source/loadImage";

export function UploadDropzone() {
  const setImage = useStore((s) => s.setImage);
  const imageName = useStore((s) => s.imageName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!isAccepted(file)) {
      setError("Use PNG, JPG, WEBP, or SVG.");
      return;
    }
    setError(null);
    try {
      const bmp = await loadImageFile(file);
      setImage(bmp, file.name);
    } catch {
      setError("Could not read that file.");
    }
  }

  if (imageName) {
    return (
      <div className="upload-loaded">
        <div className="upload-name" title={imageName}>
          {imageName}
        </div>
        <div className="upload-actions">
          <button type="button" className="btn-quiet" onClick={() => inputRef.current?.click()}>
            Replace
          </button>
          <button type="button" className="btn-quiet" onClick={() => setImage(null)}>
            Remove
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    );
  }

  return (
    <div className="ctl">
      <button
        type="button"
        className="dropzone"
        data-over={over}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 16V4m0 0L7 9m5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="dropzone-title">Drop image or click</span>
        <span className="dropzone-hint">PNG · JPG · WEBP · SVG</span>
      </button>
      {error && <div className="ctl-error">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        hidden
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
