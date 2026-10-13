import { useMemo, useState } from "react";
import { useStore } from "../store";
import { formatDuration, type TabId } from "../types";

export function LibraryViews({ tab }: { tab: TabId }) {
  const { library, playSongs, go, indexing, refresh } = useStore();
  const [sort, setSort] = useState("name");

  const songs = useMemo(() => {
    const arr = [...library.songs];
    if (sort === "date") arr.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    else arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
  }, [library, sort]);

  if (indexing) return <p>Indexing library…</p>;

  if (!library.songs.length) {
    return (
      <div>
        <h2>No music yet</h2>
        <p className="muted">
          Add a music folder in Settings, or preview with built-in sample data.
        </p>
        <button className="primary" onClick={() => void refresh()}>
          Rescan
        </button>
      </div>
    );
  }

  if (tab === "songs") {
    const uids = songs.map((s) => s.uid);
    return (
      <div>
        <div className="toolbar">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Sort: Name</option>
            <option value="date">Sort: Date</option>
          </select>
          <button className="ghost" onClick={() => playSongs(uids, 0)}>
            Play all
          </button>
        </div>
        {songs.map((s, i) => (
          <div
            key={s.uid}
            className="list-row"
            onClick={() => playSongs(uids, i)}
          >
            <span className="muted">{s.track ?? i + 1}</span>
            <div style={{ flex: 1 }}>
              <div>{s.title}</div>
              <div className="muted">
                {s.artistNames.join(", ")} • {s.albumName}
              </div>
            </div>
            <span className="muted">{formatDuration(s.durationMs)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "albums") {
    return (
      <div className="grid">
        {library.albums.map((a) => (
          <div key={a.uid} className="card" onClick={() => go({ kind: "album", uid: a.uid })}>
            <div className="cover">💿</div>
            <h4>{a.name}</h4>
            <p>
              {a.artistNames.join(", ")} • {a.releaseType}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "artists") {
    return (
      <div className="grid">
        {library.artists.map((a) => (
          <div key={a.uid} className="card" onClick={() => go({ kind: "artist", uid: a.uid })}>
            <div className="cover">🎤</div>
            <h4>{a.name}</h4>
            <p>
              {a.explicitAlbumUids.length} albums • {a.songUids.length} songs
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "genres") {
    return (
      <div className="grid">
        {library.genres.map((g) => (
          <div key={g.uid} className="card" onClick={() => go({ kind: "genre", uid: g.uid })}>
            <div className="cover">🎶</div>
            <h4>{g.name}</h4>
            <p>{g.songUids.length} songs</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid">
      {library.playlists.map((p) => (
        <div key={p.uid} className="card" onClick={() => go({ kind: "playlist", uid: p.uid })}>
          <div className="cover">📝</div>
          <h4>{p.name}</h4>
          <p>{p.songUids.length} songs</p>
        </div>
      ))}
    </div>
  );
}
