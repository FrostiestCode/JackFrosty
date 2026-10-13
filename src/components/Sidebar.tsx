import { useStore } from "../store";
import type { TabId } from "../types";

const TABS: { id: TabId; label: string }[] = [
  { id: "songs", label: "Songs" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
  { id: "genres", label: "Genres" },
  { id: "playlists", label: "Playlists" },
];

export function Sidebar() {
  const { view, go, settings } = useStore();
  const tabs = TABS.filter((t) => settings.tabs.includes(t.id));
  return (
    <aside className="sidebar">
      <div className="brand">
        ❄ JackFrosty<small>Auxio for desktop</small>
      </div>
      {tabs.map((t) => (
        <button
          key={t.id}
          className={
            "nav-btn" + (view.kind === "home" && view.tab === t.id ? " active" : "")
          }
          onClick={() => go({ kind: "home", tab: t.id })}
        >
          {t.label}
        </button>
      ))}
      <button
        className={"nav-btn" + (view.kind === "search" ? " active" : "")}
        onClick={() => go({ kind: "search" })}
      >
        Search
      </button>
      <button
        className={"nav-btn" + (view.kind === "settings" ? " active" : "")}
        onClick={() => go({ kind: "settings" })}
      >
        Settings
      </button>
    </aside>
  );
}
