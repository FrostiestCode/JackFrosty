// Mirrors org.oxycblt.musikr Music.kt / Library.kt + Auxio playback state.
// Keep field names JSON-stable with src-tauri/src/library.rs.

export interface Song {
  uid: string;
  title: string;
  albumUid: string;
  albumName: string;
  artistUids: string[];
  artistNames: string[];
  genreUids: string[];
  genreNames: string[];
  track?: number | null;
  disc?: number | null;
  date?: string | null;
  durationMs: number;
  bitrateKbps?: number | null;
  sampleRateHz?: number | null;
  path: string;
  format: string;
  replayGainDb?: number | null;
  coverId?: string | null;
}

export interface Album {
  uid: string;
  name: string;
  artistUids: string[];
  artistNames: string[];
  songUids: string[];
  releaseType: string;
  dateRange?: string | null;
  durationMs: number;
  coverId?: string | null;
}

export interface Artist {
  uid: string;
  name: string;
  explicitAlbumUids: string[];
  implicitAlbumUids: string[];
  songUids: string[];
  durationMs: number;
  coverId?: string | null;
}

export interface Genre {
  uid: string;
  name: string;
  songUids: string[];
  artistUids: string[];
  durationMs: number;
}

export interface Playlist {
  uid: string;
  name: string;
  songUids: string[];
  durationMs: number;
}

export interface Library {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  genres: Genre[];
  playlists: Playlist[];
}

export const emptyLibrary: Library = {
  songs: [],
  albums: [],
  artists: [],
  genres: [],
  playlists: [],
};

export type TabId = "songs" | "albums" | "artists" | "genres" | "playlists";
export type View =
  | { kind: "home"; tab: TabId }
  | { kind: "search" }
  | { kind: "settings" }
  | { kind: "album"; uid: string }
  | { kind: "artist"; uid: string }
  | { kind: "genre"; uid: string }
  | { kind: "playlist"; uid: string };

export type RepeatMode = "none" | "all" | "track";

export interface PlaybackStatus {
  songUid?: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  repeat: RepeatMode;
  shuffled: boolean;
  volume: number;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
