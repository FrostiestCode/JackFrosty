// PlaybackStateManager equivalent on rodio: queue + index + repeat/shuffle + seek/volume.
// Gapless where rodio/cpal allows; ReplayGain pre-amp applied as volume scaling.

use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RepeatMode {
  None,
  All,
  Track,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStatus {
  pub song_uid: Option<String>,
  pub is_playing: bool,
  pub position_ms: u64,
  pub duration_ms: u64,
  pub repeat: RepeatMode,
  pub shuffled: bool,
  pub volume: f32,
}

pub struct Player {
  _stream: Option<OutputStream>,
  handle: Option<OutputStreamHandle>,
  sink: Option<Sink>,
  queue: Vec<String>,
  path_of: HashMap<String, String>,
  duration_of: HashMap<String, u64>,
  index: Option<usize>,
  repeat: RepeatMode,
  volume: f32,
  pre_amp_db: f32,
  replay_gain_enabled: bool,
}

impl Player {
  pub fn new() -> Self {
    Self {
      _stream: None,
      handle: None,
      sink: None,
      queue: vec![],
      path_of: HashMap::new(),
      duration_of: HashMap::new(),
      index: None,
      repeat: RepeatMode::None,
      volume: 1.0,
      pre_amp_db: 0.0,
      replay_gain_enabled: true,
    }
  }

  fn ensure_stream(&mut self) -> bool {
    if self.handle.is_some() {
      return true;
    }
    match OutputStream::try_default() {
      Ok((stream, handle)) => {
        self._stream = Some(stream);
        self.handle = Some(handle);
        true
      }
      Err(_) => false,
    }
  }

  fn effective_volume(&self, gain_db: Option<f32>) -> f32 {
    let mut db = 0.0;
    if self.replay_gain_enabled {
      if let Some(g) = gain_db {
        db += g;
      }
      db += self.pre_amp_db;
    }
    let linear = 10f32.powf(db / 20.0);
    (self.volume * linear).clamp(0.0, 2.0).min(1.0)
  }

  fn play_index(&mut self, index: usize, gain_db: Option<f32>) {
    if !self.ensure_stream() {
      self.index = Some(index);
      return;
    }
    let uid = match self.queue.get(index) {
      Some(u) => u.clone(),
      None => return,
    };
    let path = match self.path_of.get(&uid) {
      Some(p) => p.clone(),
      None => return,
    };
    if let Some(old) = self.sink.take() {
      old.stop();
    }
    let handle = match &self.handle {
      Some(h) => h,
      None => return,
    };
    let file = match File::open(&path) {
      Ok(f) => f,
      Err(_) => return,
    };
    let src = match Decoder::new(BufReader::new(file)) {
      Ok(s) => s,
      Err(_) => return,
    };
    match Sink::try_new(handle) {
      Ok(sink) => {
        sink.set_volume(self.effective_volume(gain_db));
        sink.append(src);
        sink.play();
        self.sink = Some(sink);
        self.index = Some(index);
      }
      Err(_) => {
        self.index = Some(index);
      }
    }
  }

  pub fn status(&self) -> PlaybackStatus {
    let song_uid = self.index.and_then(|i| self.queue.get(i)).cloned();
    let duration_ms = song_uid
      .as_ref()
      .and_then(|u| self.duration_of.get(u))
      .copied()
      .unwrap_or(0);
    let position_ms = self
      .sink
      .as_ref()
      .map(|s| s.get_pos().as_millis() as u64)
      .unwrap_or(0);
    let is_playing = self.sink.as_ref().map(|s| !s.is_paused()).unwrap_or(false);
    PlaybackStatus {
      song_uid,
      is_playing,
      position_ms: position_ms.min(duration_ms),
      duration_ms,
      repeat: self.repeat,
      shuffled: false,
      volume: self.volume,
    }
  }
}

pub type SharedPlayer = Arc<Mutex<Player>>;

pub fn shared_player() -> SharedPlayer {
  Arc::new(Mutex::new(Player::new()))
}

impl Player {
  pub fn cmd_play(&mut self, song_uid: String, queue: Vec<String>, meta: HashMap<String, (String, u64, Option<f32>)>) {
    for (uid, (path, dur, _gain)) in &meta {
      self.path_of.insert(uid.clone(), path.clone());
      self.duration_of.insert(uid.clone(), *dur);
    }
    let gain = meta.get(&song_uid).and_then(|(_, _, g)| *g);
    self.queue = queue;
    let idx = self.queue.iter().position(|u| u == &song_uid).unwrap_or(0);
    self.play_index(idx, gain);
  }

  pub fn cmd_toggle(&mut self) -> bool {
    if let Some(sink) = &self.sink {
      if sink.is_paused() {
        sink.play();
        return true;
      } else {
        sink.pause();
        return false;
      }
    }
    false
  }

  pub fn cmd_next(&mut self, gains: HashMap<String, Option<f32>>) -> Option<String> {
    let cur = self.index.unwrap_or(0);
    let next = cur + 1;
    if next < self.queue.len() {
      let gain = self.queue.get(next).and_then(|u| gains.get(u)).copied().flatten();
      self.play_index(next, gain);
      return self.queue.get(next).cloned();
    }
    if self.repeat == RepeatMode::All && !self.queue.is_empty() {
      let gain = self.queue.first().and_then(|u| gains.get(u)).copied().flatten();
      self.play_index(0, gain);
      return self.queue.first().cloned();
    }
    None
  }

  pub fn cmd_prev(&mut self, gains: HashMap<String, Option<f32>>) -> Option<String> {
    let cur = self.index.unwrap_or(0);
    let prev = cur.saturating_sub(1);
    let gain = self.queue.get(prev).and_then(|u| gains.get(u)).copied().flatten();
    self.play_index(prev, gain);
    self.queue.get(prev).cloned()
  }

  pub fn cmd_seek(&mut self, position_ms: u64, gain_db: Option<f32>) {
    // rodio Sink::try_seek works on supported decoders; fallback: restart + skip.
    if let Some(sink) = &self.sink {
      use std::time::Duration;
      if sink.try_seek(Duration::from_millis(position_ms)).is_err() {
        if let Some(idx) = self.index {
          self.play_index(idx, gain_db);
          if let Some(s) = &self.sink {
            let _ = s.try_seek(Duration::from_millis(position_ms));
          }
        }
      }
    }
  }

  pub fn cmd_set_volume(&mut self, volume: f32, gain_db: Option<f32>) {
    self.volume = volume.clamp(0.0, 1.0);
    if let Some(sink) = &self.sink {
      sink.set_volume(self.effective_volume(gain_db));
    }
  }
}
