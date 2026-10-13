// Desktop equivalent of musikr pipeline: Explore (walkdir) → Extract (lofty/TagLib)
// → Evaluate (album/artist/genre graph). Covers cached as embedded picture bytes.

use lofty::file::AudioFile;
use lofty::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use walkdir::WalkDir;

const AUDIO_EXTS: &[&str] = &[
  "mp3", "flac", "ogg", "oga", "opus", "m4a", "mp4", "wav", "aiff", "aif", "wma", "alac",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Song {
  pub uid: String,
  pub title: String,
  pub album_uid: String,
  pub album_name: String,
  pub artist_uids: Vec<String>,
  pub artist_names: Vec<String>,
  pub genre_uids: Vec<String>,
  pub genre_names: Vec<String>,
  pub track: Option<u32>,
  pub disc: Option<u32>,
  pub date: Option<String>,
  pub duration_ms: u64,
  pub bitrate_kbps: Option<u32>,
  pub sample_rate_hz: Option<u32>,
  pub path: String,
  pub format: String,
  pub replay_gain_db: Option<f32>,
  pub cover_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Album {
  pub uid: String,
  pub name: String,
  pub artist_uids: Vec<String>,
  pub artist_names: Vec<String>,
  pub song_uids: Vec<String>,
  pub release_type: String,
  pub date_range: Option<String>,
  pub duration_ms: u64,
  pub cover_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
  pub uid: String,
  pub name: String,
  pub explicit_album_uids: Vec<String>,
  pub implicit_album_uids: Vec<String>,
  pub song_uids: Vec<String>,
  pub duration_ms: u64,
  pub cover_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Genre {
  pub uid: String,
  pub name: String,
  pub song_uids: Vec<String>,
  pub artist_uids: Vec<String>,
  pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
  pub uid: String,
  pub name: String,
  pub song_uids: Vec<String>,
  pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Library {
  pub songs: Vec<Song>,
  pub albums: Vec<Album>,
  pub artists: Vec<Artist>,
  pub genres: Vec<Genre>,
  pub playlists: Vec<Playlist>,
}

fn stable_uid(kind: &str, name: &str) -> String {
  let digest = Uuid::new_v5(&Uuid::NAMESPACE_URL, format!("jackfrosty:{kind}:{name}",).as_bytes());
  format!("{kind}-{digest}")
}

fn is_audio(p: &Path) -> bool {
  p.extension()
    .and_then(|e| e.to_str())
    .map(|e| AUDIO_EXTS.contains(&e.to_lowercase().as_str()))
    .unwrap_or(false)
}

#[derive(Default)]
struct RawSong {
  path: PathBuf,
  title: String,
  album: String,
  artists: Vec<String>,
  genres: Vec<String>,
  track: Option<u32>,
  disc: Option<u32>,
  date: Option<String>,
  duration_ms: u64,
  bitrate_kbps: Option<u32>,
  sample_rate_hz: Option<u32>,
  format: String,
  replay_gain_db: Option<f32>,
  has_cover: bool,
}

fn split_multi(value: &str) -> Vec<String> {
  // Auxio "Separators" equivalent; desktop default splits on ; / , like Settings.
  let mut out = Vec::new();
  for part in value.split([';', '/', ',']) {
    let p = part.trim();
    if !p.is_empty() {
      out.push(p.to_string());
    }
  }
  if out.is_empty() && !value.trim().is_empty() {
    out.push(value.trim().to_string());
  }
  out
}

fn read_raw(path: &Path) -> Option<RawSong> {
  let tagged = lofty::read_from_path(path).ok()?;
  let props = tagged.properties();
  let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;

  let title = tag.title().map(|t| t.to_string()).unwrap_or_else(|| {
    path.file_stem()
      .and_then(|s| s.to_str())
      .unwrap_or("Unknown Title")
      .to_string()
  });
  let album = tag.album().map(|t| t.to_string()).unwrap_or_else(|| "Unknown Album".into());
  let artist_raw = tag.artist().map(|t| t.to_string()).unwrap_or_else(|| "Unknown Artist".into());
  let genre_raw = tag.genre().map(|t| t.to_string()).unwrap_or_default();
  let artists = split_multi(&artist_raw);
  let genres = if genre_raw.trim().is_empty() { vec![] } else { split_multi(&genre_raw) };
  let date = tag.year().map(|y| y.to_string()).or_else(|| {
    tag.get_string(&lofty::tag::ItemKey::RecordingDate)
      .map(|s| s.to_string())
  });

  let format = path
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("audio")
    .to_uppercase();

  let has_cover = tag.pictures().first().is_some();

  Some(RawSong {
    path: path.to_path_buf(),
    title,
    album,
    artists,
    genres,
    track: tag.track(),
    disc: tag.disk(),
    date,
    duration_ms: props.duration().as_millis() as u64,
    bitrate_kbps: props.audio_bitrate(),
    sample_rate_hz: props.sample_rate(),
    format,
    replay_gain_db: None, // TODO: parse REPLAYGAIN_TRACK_GAIN via tag.get_string
    has_cover,
  })
}

pub fn scan_dirs(dirs: Vec<String>) -> Library {
  let mut raw: Vec<RawSong> = Vec::new();
  let mut m3u_files: Vec<PathBuf> = Vec::new();

  for dir in dirs {
    let root = PathBuf::from(&dir);
    if !root.exists() {
      continue;
    }
    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
      let p = entry.path().to_path_buf();
      if p.is_file() {
        if is_audio(&p) {
          if let Some(r) = read_raw(&p) {
            raw.push(r);
          }
        } else if p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("m3u") || e.eq_ignore_ascii_case("m3u8")).unwrap_or(false) {
          m3u_files.push(p);
        }
      }
    }
  }

  raw.sort_by(|a, b| a.path.cmp(&b.path));

  // Evaluate step: build graph.
  let mut songs: Vec<Song> = Vec::new();
  let mut albums: HashMap<String, Album> = HashMap::new();
  let mut artists: HashMap<String, Artist> = HashMap::new();
  let mut genres: HashMap<String, Genre> = HashMap::new();
  let mut path_to_uid: HashMap<String, String> = HashMap::new();

  for r in &raw {
    let song_uid = stable_uid("song", &r.path.to_string_lossy());
    path_to_uid.insert(r.path.to_string_lossy().to_string(), song_uid.clone());

    let album_uid = stable_uid("album", &format!("{}|{}", r.album, r.artists.first().cloned().unwrap_or_default()));
    let artist_uids: Vec<String> = r.artists.iter().map(|a| stable_uid("artist", a)).collect();
    let genre_uids: Vec<String> = r.genres.iter().map(|g| stable_uid("genre", g)).collect();

    songs.push(Song {
      uid: song_uid.clone(),
      title: r.title.clone(),
      album_uid: album_uid.clone(),
      album_name: r.album.clone(),
      artist_uids: artist_uids.clone(),
      artist_names: r.artists.clone(),
      genre_uids: genre_uids.clone(),
      genre_names: r.genres.clone(),
      track: r.track,
      disc: r.disc,
      date: r.date.clone(),
      duration_ms: r.duration_ms,
      bitrate_kbps: r.bitrate_kbps,
      sample_rate_hz: r.sample_rate_hz,
      path: r.path.to_string_lossy().to_string(),
      format: r.format.clone(),
      replay_gain_db: r.replay_gain_db,
      cover_id: if r.has_cover { Some(song_uid.clone()) } else { None },
    });

    let album = albums.entry(album_uid.clone()).or_insert_with(|| Album {
      uid: album_uid.clone(),
      name: r.album.clone(),
      artist_uids: artist_uids.clone(),
      artist_names: r.artists.clone(),
      song_uids: vec![],
      release_type: "Album".into(),
      date_range: r.date.clone(),
      duration_ms: 0,
      cover_id: None,
    });
    album.song_uids.push(song_uid.clone());
    album.duration_ms += r.duration_ms;
    if album.cover_id.is_none() && r.has_cover {
      album.cover_id = Some(song_uid.clone());
    }

    for (i, name) in r.artists.iter().enumerate() {
      let auid = &artist_uids[i];
      let artist = artists.entry(auid.clone()).or_insert_with(|| Artist {
        uid: auid.clone(),
        name: name.clone(),
        explicit_album_uids: vec![],
        implicit_album_uids: vec![],
        song_uids: vec![],
        duration_ms: 0,
        cover_id: None,
      });
      artist.song_uids.push(song_uid.clone());
      artist.duration_ms += r.duration_ms;
      if !artist.explicit_album_uids.contains(&album_uid) {
        artist.explicit_album_uids.push(album_uid.clone());
      }
    }

    for (i, name) in r.genres.iter().enumerate() {
      let guid = &genre_uids[i];
      let genre = genres.entry(guid.clone()).or_insert_with(|| Genre {
        uid: guid.clone(),
        name: name.clone(),
        song_uids: vec![],
        artist_uids: vec![],
        duration_ms: 0,
      });
      genre.song_uids.push(song_uid.clone());
      genre.duration_ms += r.duration_ms;
      for auid in &artist_uids {
        if !genre.artist_uids.contains(auid) {
          genre.artist_uids.push(auid.clone());
        }
      }
    }
  }

  // Release-type heuristic (Single <3 tracks, EP <6).
  for album in albums.values_mut() {
    album.release_type = match album.song_uids.len() {
      0..=2 => "Single".into(),
      3..=5 => "EP".into(),
      _ => "Album".into(),
    };
    album.song_uids.sort_by_key(|u| {
      songs.iter().find(|s| &s.uid == u).map(|s| (s.disc.unwrap_or(1), s.track.unwrap_or(0)))
    });
  }

  let mut albums: Vec<Album> = albums.into_values().collect();
  let mut artist_list: Vec<Artist> = artists.into_values().collect();
  let mut genre_list: Vec<Genre> = genres.into_values().collect();
  albums.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  artist_list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  genre_list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  songs.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));

  // M3U import (external playlists).
  let mut playlists: Vec<Playlist> = Vec::new();
  for m3u in m3u_files {
    let name = m3u.file_stem().and_then(|s| s.to_str()).unwrap_or("Playlist").to_string();
    if let Ok(text) = std::fs::read_to_string(&m3u) {
      let mut song_uids = vec![];
      let base = m3u.parent().map(|p| p.to_path_buf()).unwrap_or_default();
      for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
          continue;
        }
        let candidate = if Path::new(line).is_absolute() {
          PathBuf::from(line)
        } else {
          base.join(line)
        };
        let key = candidate.to_string_lossy().to_string();
        if let Some(uid) = path_to_uid.get(&key) {
          song_uids.push(uid.clone());
        } else {
          // Try matching by filename fallback.
          if let Some(found) = raw.iter().find(|r| r.path.ends_with(&candidate) || candidate.ends_with(r.path.file_name().unwrap_or_default())) {
            if let Some(uid) = path_to_uid.get(&found.path.to_string_lossy().to_string()) {
              song_uids.push(uid.clone());
            }
          }
        }
      }
      let duration_ms = song_uids.iter().filter_map(|u| songs.iter().find(|s| &s.uid == u)).map(|s| s.duration_ms).sum();
      playlists.push(Playlist {
        uid: stable_uid("playlist", &format!("{name}|{}", m3u.to_string_lossy())),
        name,
        song_uids,
        duration_ms,
      });
    }
  }

  Library { songs, albums, artists: artist_list, genres: genre_list, playlists }
}

/// Return embedded cover bytes for a song path (used by cover_art command).
pub fn cover_bytes_for_song(song_path: &str) -> Option<(Vec<u8>, String)> {
  let tagged = lofty::read_from_path(song_path).ok()?;
  let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
  let pic = tag.pictures().first()?;
  let mime = pic.mime_type().map(|m| m.to_string()).unwrap_or_else(|| "image/jpeg".into());
  Some((pic.data().to_vec(), mime))
}
