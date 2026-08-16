/* Mirrors backend/engine/params.py — the UI contract. */

export const KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const MODES = ["minor", "major"];
export const PROGRESSIONS = ["classic", "soulful", "jazzy", "dreamy"];
export const CHORD_EXTS = ["7", "9", "add9"];
export const VOICINGS = ["spread", "drop2", "close"];
export const BASS_STYLES = ["root-eighths", "walk", "octave-bounce", "syncopated", "pedal"];
export const DRUM_STYLES = ["boom-bap", "brushed", "four-floor", "none"];
export const MELODY_STYLES = ["sparse", "flowing", "none"];

export interface TrackParams {
  key: string;
  mode: string;
  bpm: number;
  bars: number;
  progression: string;
  chord_ext: string;
  voicing: string;
  bass_style: string;
  drums: string;
  swing: number;
  melody: string;
  ep_tone: number;
  fx_crackle: number;
  fx_wobble: number;
  fx_lowpass: number;
  fx_saturation: number;
  fx_reverb: number;
  fx_pump: number;
  seed: number;
}

export const DEFAULT_PARAMS: TrackParams = {
  key: "A",
  mode: "minor",
  bpm: 78,
  bars: 8,
  progression: "classic",
  chord_ext: "9",
  voicing: "spread",
  bass_style: "root-eighths",
  drums: "boom-bap",
  swing: 0.28,
  melody: "sparse",
  ep_tone: 0.45,
  fx_crackle: 0.35,
  fx_wobble: 0.25,
  fx_lowpass: 0.5,
  fx_saturation: 0.35,
  fx_reverb: 0.3,
  fx_pump: 0.4,
  seed: 42,
};

export interface GenerateResult {
  id: string;
  name: string;
  wav: string;
  midi: string;
  chords: string[];
  duration_s: number;
  bpm: number;
  took_ms: number;
  params: TrackParams;
}

export type Presets = Record<string, Partial<TrackParams>>;
