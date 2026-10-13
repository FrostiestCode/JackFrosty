import { create } from "zustand";
import type { Library, RepeatMode, TabId, View } from "./types";
import { emptyLibrary } from "./types";
import { mockLibrary } from "./mock";
import { playerNext, playerPlay, playerPrev, playerToggle, scanLibrary } from "./tauri";

export interface Settings {
  musicDirs: string[];
  separators: string[];
  replayGainEnabled: boolean;
  preAmpDb: number;
  accent: string;
  tabs: TabId[];
}

interface State {
  library: Library;
  indexing: boolean;
  indexError?: string | null;
  view: View;
  query: string;
  queue: string[];
  queueIndex: number;
  isPlaying: boolean;
  positionMs: number;
  repeat: RepeatMode;
  shuffled: boolean;
  volume: number;
  settings: Settings;
  queueOpen: boolean;

  go: (view: View) => void;
  setQuery: (q: string) => void;
  refresh: () => Promise<void>;
  playSongs: (uids: string[], start?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  setPosition: (ms: number) => void;
  setQueueOpen: (open: boolean) => void;
  moveInQueue: (from: number, to: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  createPlaylist: (name: string, songUids: string[]) => void;
  addToPlaylist: (playlistUid: string, songUids: string[]) => void;
}

const defaultSettings: Settings = {
  musicDirs: [],
  separators: [";", "/", ","],
  replayGainEnabled: true,
  preAmpDb: 0,
  accent: "#64b5f6",
  tabs: ["songs", "albums", "artists", "genres", "playlists"],
};

function shuffledCopy<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const useStore = create<State>((set, get) => ({
  library: emptyLibrary,
  indexing: false,
  indexError: null,
  view: { kind: "home", tab: "songs" },
  query: "",
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  positionMs: 0,
  repeat: "none",
  shuffled: false,
  volume: 1,
  settings: defaultSettings,
  queueOpen: false,

  go: (view) => set({ view }),
  setQuery: (query) => set({ query }),
  setQueueOpen: (queueOpen) => set({ queueOpen }),

  refresh: async () => {
    const { settings } = get();
    set({ indexing: true, indexError: null });
    try {
      const library = settings.musicDirs.length
        ? await scanLibrary(settings.musicDirs)
        : mockLibrary;
      set({ library, indexing: false });
    } catch (e) {
      set({ indexing: false, indexError: String(e) });
    }
  },

  playSongs: (uids, start = 0) => {
    const { shuffled } = get();
    const queue = shuffled ? shuffledCopy(uids) : [...uids];
    const queueIndex = queue.length ? 0 : -1;
    // Keep logical start: move requested song to front.
    if (uids[start] && queueIndex === 0) {
      const target = uids[start];
      const at = queue.indexOf(target);
      if (at > 0) {
        queue.splice(at, 1);
        queue.unshift(target);
      }
    }
    set({ queue, queueIndex, isPlaying: queue.length > 0, positionMs: 0 });
    const current = queue[0];
    if (current) void playerPlay(current, queue);
  },

  toggle: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
    void playerToggle();
  },
  next: () => {
    const { queue, queueIndex, repeat } = get();
    if (!queue.length) return;
    let nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeat === "all") nextIdx = 0;
      else {
        set({ isPlaying: false });
        return;
      }
    }
    set({ queueIndex: nextIdx, positionMs: 0, isPlaying: true });
    void playerNext();
  },
  prev: () => {
    const { queue, queueIndex } = get();
    if (!queue.length) return;
    const prevIdx = queueIndex <= 0 ? 0 : queueIndex - 1;
    set({ queueIndex: prevIdx, positionMs: 0, isPlaying: true });
    void playerPrev();
  },
  toggleShuffle: () => set((s) => ({ shuffled: !s.shuffled })),
  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === "none" ? "all" : s.repeat === "all" ? "track" : "none",
    })),
  setVolume: (volume) => set({ volume }),
  setPosition: (positionMs) => set({ positionMs }),
  moveInQueue: (from, to) =>
    set((s) => {
      const queue = [...s.queue];
      const [item] = queue.splice(from, 1);
      queue.splice(to, 0, item);
      let queueIndex = s.queueIndex;
      if (from === s.queueIndex) queueIndex = to;
      else if (from < s.queueIndex && to >= s.queueIndex) queueIndex -= 1;
      else if (from > s.queueIndex && to <= s.queueIndex) queueIndex += 1;
      return { queue, queueIndex };
    }),
  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),
  createPlaylist: (name, songUids) =>
    set((s) => ({
      library: {
        ...s.library,
        playlists: [
          ...s.library.playlists,
          {
            uid: `playlist-${Date.now()}`,
            name,
            songUids: [...songUids],
            durationMs: 0,
          },
        ],
      },
    })),
  addToPlaylist: (playlistUid, songUids) =>
    set((s) => ({
      library: {
        ...s.library,
        playlists: s.library.playlists.map((p) =>
          p.uid === playlistUid
            ? { ...p, songUids: [...p.songUids, ...songUids] }
            : p,
        ),
      },
    })),
}));
