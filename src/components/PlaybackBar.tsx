import { useStore } from "../store";
import { formatDuration } from "../types";
import { playerSeek } from "../tauri";

export function PlaybackBar() {
  const {
    library,
    queue,
    queueIndex,
    isPlaying,
    positionMs,
    repeat,
    shuffled,
    volume,
    toggle,
    next,
    prev,
    cycleRepeat,
    toggleShuffle,
    setPosition,
    setVolume,
    setQueueOpen,
    queueOpen,
  } = useStore();

  const current = queue[queueIndex] ?? null;
  const song = library.songs.find((s) => s.uid === current);

  return (
    <div className="playback-bar">
      <input
        className="seek"
        type="range"
        min={0}
        max={song?.durationMs ?? 1000}
        value={Math.min(positionMs, song?.durationMs ?? 0)}
        onChange={(e) => {
          const v = Number(e.target.value);
          setPosition(v);
          void playerSeek(v);
        }}
      />
      <div className="playback-main">
        <button className="ghost" onClick={prev}>⏮</button>
        <button className="primary" onClick={toggle}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button className="ghost" onClick={next}>⏭</button>
        <div style={{ flex: 1 }}>
          <div>{song ? song.title : "Nothing playing"}</div>
          <div className="muted">
            {song
              ? `${song.artistNames.join(", ")} • ${formatDuration(positionMs)} / ${formatDuration(song.durationMs)}`
              : "Add a music folder in Settings, then press Play"}
          </div>
        </div>
        <button
          className="ghost"
          title="Shuffle"
          style={{ borderColor: shuffled ? "var(--accent)" : undefined }}
          onClick={toggleShuffle}
        >
          🔀
        </button>
        <button className="ghost" title={`Repeat: ${repeat}`} onClick={cycleRepeat}>
          {repeat === "none" ? "➡" : repeat === "all" ? "🔁" : "🔂"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          title="Volume"
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ width: 90 }}
        />
        <button className="ghost" onClick={() => setQueueOpen(!queueOpen)}>
          Queue ({queue.length})
        </button>
      </div>
    </div>
  );
}
