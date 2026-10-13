import { useEffect } from "react";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { LibraryViews } from "./components/LibraryViews";
import { DetailView } from "./components/DetailView";
import { PlaybackBar } from "./components/PlaybackBar";
import { QueueDrawer } from "./components/QueueDrawer";
import { SearchView } from "./components/SearchView";
import { SettingsView } from "./components/SettingsView";

export default function App() {
  const { view, refresh, indexError } = useStore();

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lightweight position ticker for the seekbar (backend is source of truth when in Tauri).
  const { isPlaying, positionMs, setPosition, queue, queueIndex, library } = useStore();
  useEffect(() => {
    if (!isPlaying) return;
    const song = library.songs.find((s) => s.uid === queue[queueIndex]);
    const id = window.setInterval(() => {
      const next = positionMs + 500;
      if (song && next >= song.durationMs) {
        useStore.getState().next();
      } else {
        setPosition(next);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [isPlaying, positionMs, queue, queueIndex, library, setPosition]);

  return (
    <div className="app">
      <div className="main-row">
        <Sidebar />
        <main className="content">
          {indexError && <p style={{ color: "salmon" }}>{indexError}</p>}
          {view.kind === "home" && <LibraryViews tab={view.tab} />}
          {view.kind === "search" && <SearchView />}
          {view.kind === "settings" && <SettingsView />}
          {view.kind === "album" && <DetailView uid={view.uid} kind="album" />}
          {view.kind === "artist" && <DetailView uid={view.uid} kind="artist" />}
          {view.kind === "genre" && <DetailView uid={view.uid} kind="genre" />}
          {view.kind === "playlist" && <DetailView uid={view.uid} kind="playlist" />}
        </main>
      </div>
      <PlaybackBar />
      <QueueDrawer />
    </div>
  );
}
