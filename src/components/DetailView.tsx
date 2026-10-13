import { useStore } from "../store";
import { formatDuration } from "../types";

export function DetailView({ uid, kind }: { uid: string; kind: "album" | "artist" | "genre" | "playlist" }) {
  const { library, playSongs, go } = useStore();
  const byUid = new Map(library.songs.map((s) => [s.uid, s]));

  let title = "";
  let subtitle = "";
  let songUids: string[] = [];

  if (kind === "album") {
    const a = library.albums.find((x) => x.uid === uid);
    if (!a) return <p>Not found</p>;
    title = a.name;
    subtitle = `${a.artistNames.join(", ")} • ${a.releaseType} • ${a.dateRange ?? ""}`;
    songUids = a.songUids;
  } else if (kind === "artist") {
    const a = library.artists.find((x) => x.uid === uid);
    if (!a) return <p>Not found</p>;
    title = a.name;
    subtitle = `${a.explicitAlbumUids.length} albums • ${formatDuration(a.durationMs)}`;
    songUids = a.songUids;
  } else if (kind === "genre") {
    const g = library.genres.find((x) => x.uid === uid);
    if (!g) return <p>Not found</p>;
    title = g.name;
    subtitle = `${g.songUids.length} songs`;
    songUids = g.songUids;
  } else {
    const p = library.playlists.find((x) => x.uid === uid);
    if (!p) return <p>Not found</p>;
    title = p.name;
    subtitle = `${p.songUids.length} songs • ${formatDuration(p.durationMs)}`;
    songUids = p.songUids;
  }

  const songs = songUids.map((u) => byUid.get(u)).filter(Boolean);

  return (
    <div>
      <button className="ghost" onClick={() => go({ kind: "home", tab: "albums" })}>
        ← Back
      </button>
      <h2>{title}</h2>
      <p className="muted">{subtitle}</p>
      <div className="toolbar">
        <button className="primary" onClick={() => playSongs(songUids, 0)}>
          Play
        </button>
        <button className="ghost" onClick={() => playSongs([...songUids].reverse(), 0)}>
          Shuffle
        </button>
      </div>
      {songs.map((s, i) =>
        s ? (
          <div key={s.uid} className="list-row" onClick={() => playSongs(songUids, i)}>
            <span className="muted">{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div>{s.title}</div>
              <div className="muted">
                {s.artistNames.join(", ")} • {s.albumName}
              </div>
            </div>
            <span className="muted">{formatDuration(s.durationMs)}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}
