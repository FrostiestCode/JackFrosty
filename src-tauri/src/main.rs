// JackFrosty Tauri entry: wires library.rs (musikr port) + player.rs (ExoPlayer port).
// Windows is the default bundle target; macOS/Linux share the same commands.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod library;
mod player;

use player::{shared_player, PlaybackStatus, SharedPlayer};
use std::collections::HashMap;
use tauri::Manager;

#[tauri::command]
fn scan_library(dirs: Vec<String>) -> library::Library {
    library::scan_dirs(dirs)
}

#[tauri::command]
fn cover_art(song_path: String) -> Option<String> {
    let (bytes, mime) = library::cover_bytes_for_song(&song_path)?;
    // Cap at ~2MB to keep IPC small.
    if bytes.len() > 2 * 1024 * 1024 {
        return None;
    }
    Some(format!("data:{mime};base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)))
}

#[tauri::command]
fn player_play(
    state: tauri::State<SharedPlayer>,
    song_uid: String,
    queue: Vec<String>,
    meta: Option<HashMap<String, (String, u64, Option<f32>)>>,
) -> Result<(), String> {
    let mut p = state.lock().map_err(|e| e.to_string())?;
    p.cmd_play(song_uid, queue, meta.unwrap_or_default());
    Ok(())
}

#[tauri::command]
fn player_toggle(state: tauri::State<SharedPlayer>) -> Result<PlaybackStatus, String> {
    let mut p = state.lock().map_err(|e| e.to_string())?;
    p.cmd_toggle();
    Ok(p.status())
}

#[tauri::command]
fn player_next(
    state: tauri::State<SharedPlayer>,
    gains: Option<HashMap<String, Option<f32>>>,
) -> Result<Option<String>, String> {
    let mut p = state.lock().map_err(|e| e.to_string())?;
    Ok(p.cmd_next(gains.unwrap_or_default()))
}

#[tauri::command]
fn player_prev(
    state: tauri::State<SharedPlayer>,
    gains: Option<HashMap<String, Option<f32>>>,
) -> Result<Option<String>, String> {
    let mut p = state.lock().map_err(|e| e.to_string())?;
    Ok(p.cmd_prev(gains.unwrap_or_default()))
}

#[tauri::command]
fn player_seek(state: tauri::State<SharedPlayer>, position_ms: u64) -> Result<(), String> {
    let mut p = state.lock().map_err(|e| e.to_string())?;
    p.cmd_seek(position_ms, None);
    Ok(())
}

#[tauri::command]
fn player_set_volume(state: tauri::State<SharedPlayer>, volume: f32) -> Result<(), String> {
    let mut p = state.lock().map_err(|e| e.to_string())?;
    p.cmd_set_volume(volume, None);
    Ok(())
}

#[tauri::command]
fn player_status(state: tauri::State<SharedPlayer>) -> Result<PlaybackStatus, String> {
    let p = state.lock().map_err(|e| e.to_string())?;
    Ok(p.status())
}

fn main() {
    let player: SharedPlayer = shared_player();
    tauri::Builder::default()
        .manage(player)
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            scan_library,
            cover_art,
            player_play,
            player_toggle,
            player_next,
            player_prev,
            player_seek,
            player_set_volume,
            player_status
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(win) = app.get_webview_window("main") {
                    win.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running JackFrosty");
}
