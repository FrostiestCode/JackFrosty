// Safe wrapper around Tauri invoke() with graceful browser fallback.
// In `npm run dev` (no Tauri), all calls resolve to mock/no-op values.

import { mockLibrary } from "./mock";
import type { Library, PlaybackStatus } from "./types";

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) throw new Error("not-tauri");
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke<T>(cmd, args);
}

export async function scanLibrary(dirs: string[]): Promise<Library> {
  try {
    return await invoke<Library>("scan_library", { dirs });
  } catch {
    return mockLibrary;
  }
}

export async function playerPlay(songUid: string, queue: string[]): Promise<void> {
  try {
    await invoke("player_play", { songUid, queue });
  } catch {
    /* browser preview: store handles it */
  }
}

export async function playerToggle(): Promise<PlaybackStatus | null> {
  try {
    return await invoke<PlaybackStatus>("player_toggle");
  } catch {
    return null;
  }
}

export async function playerNext(): Promise<string | null> {
  try {
    return await invoke<string | null>("player_next");
  } catch {
    return null;
  }
}

export async function playerPrev(): Promise<string | null> {
  try {
    return await invoke<string | null>("player_prev");
  } catch {
    return null;
  }
}

export async function playerSeek(positionMs: number): Promise<void> {
  try {
    await invoke("player_seek", { positionMs });
  } catch {
    /* noop */
  }
}

export async function playerSetVolume(volume: number): Promise<void> {
  try {
    await invoke("player_set_volume", { volume });
  } catch {
    /* noop */
  }
}

export async function playerStatus(): Promise<PlaybackStatus | null> {
  try {
    return await invoke<PlaybackStatus>("player_status");
  } catch {
    return null;
  }
}

export async function pickMusicDirs(): Promise<string[]> {
  try {
    const d = await import("@tauri-apps/plugin-dialog");
    const selected = await d.open({ directory: true, multiple: true });
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  } catch {
    return [];
  }
}

export function runningInTauri(): boolean {
  return isTauri;
}
