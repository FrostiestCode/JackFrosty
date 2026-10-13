import { useState } from "react";
import { useStore } from "../store";
import { pickMusicDirs, runningInTauri } from "../tauri";

export function SettingsView() {
  const { settings, updateSettings, refresh, indexing } = useStore();
  const [dirInput, setDirInput] = useState("");

  return (
    <div>
      <h2>Settings</h2>

      <h3>Music locations</h3>
      <p className="muted">
        Desktop equivalent of Auxio's SAF locations. {runningInTauri() ? "" : "(browser preview: uses sample data)"}
      </p>
      {settings.musicDirs.map((d) => (
        <div key={d} className="row" style={{ marginBottom: 6 }}>
          <code style={{ flex: 1 }}>{d}</code>
          <button
            className="ghost"
            onClick={() =>
              updateSettings({ musicDirs: settings.musicDirs.filter((x) => x !== d) })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <div className="row">
        <button
          className="ghost"
          onClick={() =>
            void pickMusicDirs().then((dirs) => {
              if (dirs.length)
                updateSettings({ musicDirs: [...settings.musicDirs, ...dirs] });
            })
          }
        >
          Browse…
        </button>
        <input
          type="text"
          placeholder="Or paste a path, e.g. C:\Music"
          value={dirInput}
          onChange={(e) => setDirInput(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          className="ghost"
          onClick={() => {
            if (dirInput.trim())
              updateSettings({ musicDirs: [...settings.musicDirs, dirInput.trim()] });
            setDirInput("");
          }}
        >
          Add
        </button>
        <button className="primary" onClick={() => void refresh()} disabled={indexing}>
          {indexing ? "Scanning…" : "Rescan"}
        </button>
      </div>

      <h3>Audio</h3>
      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={settings.replayGainEnabled}
            onChange={(e) => updateSettings({ replayGainEnabled: e.target.checked })}
          />{" "}
          ReplayGain (like Auxio: MP3/FLAC/OGG/OPUS/M4A)
        </label>
      </div>
      <div className="row">
        <label>
          Pre-amp (dB):{" "}
          <input
            type="number"
            value={settings.preAmpDb}
            min={-15}
            max={15}
            step={0.5}
            onChange={(e) => updateSettings({ preAmpDb: Number(e.target.value) })}
          />
        </label>
      </div>

      <h3>Personalize</h3>
      <div className="row">
        <label>
          Accent:{" "}
          <input
            type="color"
            value={settings.accent}
            onChange={(e) => {
              updateSettings({ accent: e.target.value });
              document.documentElement.style.setProperty("--accent", e.target.value);
            }}
          />
        </label>
      </div>
      <p className="muted">
        Tag separators (Auxio “Separators”):{" "}
        <input
          type="text"
          value={settings.separators.join(" ")}
          onChange={(e) =>
            updateSettings({ separators: e.target.value.split(" ").filter(Boolean) })
          }
        />
      </p>

      <h3>About</h3>
      <p className="muted">
        JackFrosty 0.1.0 — GPL-3.0. Desktop port of Auxio's opinionated local-music UX.
        Playback: rodio (gapless where supported). Tags: lofty (TagLib equivalent).
      </p>
    </div>
  );
}
