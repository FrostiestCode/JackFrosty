# JackFrosty

Auxio-inspired local music player for **desktop**, built with **Tauri 2 + React + TypeScript** (Rust backend, web frontend).

Default target: **Windows**. Also builds for **macOS** and **Linux** via Tauri.

Original Android source (reference only, GPL-3.0): `../AndriodAuxioAppSrc/` (Auxio by OxygenCobalt + `musikr` pipeline + patched Media3).

## Feature parity goals (ported from Auxio)

| Auxio (Android) | JackFrosty (desktop) |
|---|---|
| `musikr` pipeline: Explore → Extract (TagLib) → Evaluate (graph) | Rust `library.rs`: `walkdir` scan → `lofty` tags → album/artist/genre graph + cover cache |
| Songs / Albums / Artists / Genres / Playlists tabs, sortable + reorderable | Sidebar tabs + sortable lists (`LibraryViews.tsx`) |
| Album/Artist/Genre/Playlist detail + song properties dialog | `DetailView.tsx` |
| Playback bar + expanded panel + queue sheet, ExoPlayer + ReplayGain + gapless | Rust `player.rs` (`rodio` sink, queue, shuffle/repeat, seek, volume, ReplayGain pre-amp) + `PlaybackBar.tsx` + `QueueDrawer.tsx` |
| Live search with type filters | `SearchView.tsx` |
| Settings (UI / Personalize / Music dirs+separators / Audio) + About | `SettingsView.tsx`, persisted via `tauri-plugin-store` |
| M3U import/export, playlist CRUD | `scan_library` + `playlist_*.rs` commands + store actions |
| Android widgets / Auto / headset autoplay | Out of scope for desktop v1 (system MPRIS/media-keys planned) |

## Dev

```powershell
cd jackfrosty
npm install
npm run tauri:dev
```

Requirements: Node 20+, Rust stable (1.77+), WebView2 (Windows, preinstalled on Win10/11), platform audio deps.

## Build

```powershell
npm run tauri:build
```

Artifacts:
- Windows (default): `src-tauri/target/release/bundle/nsis/*.exe`, `msi/`
- Linux: `.AppImage`, `.deb`
- macOS: `.app`, `.dmg`

## Project layout

```
jackfrosty/
  src/                 # React+TS frontend (mirrors Auxio home/detail/playback/search/settings)
    types.ts           # Song/Album/Artist/Genre/Playlist/Library (mirrors musikr Music.kt/Library.kt)
    tauri.ts           # invoke() wrappers with browser/mock fallback
    mock.ts            # sample library for `npm run dev` without backend
    store.ts           # zustand: library + playback queue + settings + navigation
    components/        # Sidebar, LibraryViews, DetailView, PlaybackBar, QueueDrawer, SearchView, SettingsView
  src-tauri/
    tauri.conf.json    # windows default, macOS + linux targets
    src/main.rs        # Tauri commands wiring
    src/library.rs     # scan + tag parse + graph + covers + m3u
    src/player.rs      # rodio queue player
```

## License

GPL-3.0-or-later (matches Auxio). See `../AndriodAuxioAppSrc/LICENSE`.
