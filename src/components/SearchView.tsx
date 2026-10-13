import { useMemo } from "react";
import { useStore } from "../store";

export function SearchView() {
  const { library, query, setQuery, playSongs, go } = useStore();

  const q = query.trim().toLowerCase();
  const songs = useMemo(
    () =>
      q
        ? library.songs
            .filter(
              (s) =>
                s.title.toLowerCase().includes(q) ||
                s.albumName.toLowerCase().includes(q) ||
                s.artistNames.join(" ").toLowerCase().includes(q),
            )
            .slice(0, 50)
        : [],
    [library, q],
  );
  const albums = useMemo(
    () =>
      q
        ? library.albums.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 20)
        : [],
    [library, q],
  );
  const artists = useMemo(
    () =>
      q
        ? library.artists.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 20)
        : [],
    [library, q],
  );

  return (
    <div>
      <h2>Search</h2>
      <input
        type="text"
        placeholder="Songs, albums, artists…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", maxWidth: 480 }}
      />
      {!!songs.length && (
        <>
          <h3>Songs</h3>
          {songs.map((s) => (
            <div
              key={s.uid}
              className="list-row"
              onClick={() => playSongs([s.uid], 0)}
            >
              <div style={{ flex: 1 }}>
                <div>{s.title}</div>
                <div className="muted">
                  {s.artistNames.join(", ")} • {s.albumName}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      {!!albums.length && (
        <>
          <h3>Albums</h3>
          <div className="grid">
            {albums.map((a) => (
              <div key={a.uid} className="card" onClick={() => go({ kind: "album", uid: a.uid })}>
                <h4>{a.name}</h4>
                <p>{a.artistNames.join(", ")}</p>
              </div>
            ))}
          </div>
        </>
      )}
      {!!artists.length && (
        <>
          <h3>Artists</h3>
          <div className="grid">
            {artists.map((a) => (
              <div key={a.uid} className="card" onClick={() => go({ kind: "artist", uid: a.uid })}>
                <h4>{a.name}</h4>
                <p>{a.songUids.length} songs</p>
              </div>
            ))}
          </div>
        </>
      )}
      {q && !songs.length && !albums.length && !artists.length && (
        <p className="muted">No results for “{query}”.</p>
      )}
    </div>
  );
}
