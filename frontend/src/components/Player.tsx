/* Now Playing — player card: waveform (pixel-grid, beautifului loader vibe),
   chord strip, transport, downloads. */

import { useEffect, useRef, useState } from "react";
import type { GenerateResult } from "../types";
import { Chip } from "./controls";

function useWaveform(url: string | null, playing: boolean, bars = 64) {
  const [levels, setLevels] = useState<number[]>([]);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    if (!url) {
      setLevels([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const ctx = new AudioContext();
        const audio = await ctx.decodeAudioData(buf);
        if (cancelled) return;
        const ch = audio.getChannelData(0);
        const step = Math.floor(ch.length / bars);
        const out: number[] = [];
        for (let i = 0; i < bars; i++) {
          let peak = 0;
          for (let j = i * step; j < (i + 1) * step; j++) peak = Math.max(peak, Math.abs(ch[j]));
          out.push(peak);
        }
        setLevels(out);
      } catch {
        /* ignore decode errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, bars]);

  return levels;
}

function fmtTime(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function Player({ track, url }: { track: GenerateResult | null; url: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const levels = useWaveform(url, playing);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setT(a.currentTime);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [track]);

  useEffect(() => {
    if (!track) setPlaying(false);
  }, [track]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !url) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  if (!track || !url) {
    return (
      <div className="card p-6 flex flex-col gap-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
          Now playing
        </p>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="waveform-bars w-full max-w-[320px]">
            {Array.from({ length: 48 }).map((_, i) => (
              <i key={i} className="shimmer" style={{ height: `${20 + ((i * 7) % 60)}%` }} />
            ))}
          </div>
          <p className="text-[13px] text-ink-3">
            No track yet — tweak the knobs and hit{" "}
            <span className="text-accent-ink">Generate a track</span>.
          </p>
        </div>
      </div>
    );
  }

  const dur = track.duration_s + 2;

  return (
    <div className="card p-6 flex flex-col gap-5 fade-up">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
          Now playing
        </p>
        <Chip accent>rendered in {(track.took_ms / 1000).toFixed(1)}s</Chip>
      </div>

      <div>
        <h3 className="text-[17px] font-semibold tracking-tight">{track.name}</h3>
        <p className="text-[12.5px] text-ink-3 mt-0.5 font-mono">
          seed {track.params.seed} · {track.bpm} bpm · {track.params.bars} bars
        </p>
      </div>

      <div className="waveform-bars">
        {levels.length > 0
          ? levels.map((l, i) => (
              <i
                key={i}
                className="rounded-sm"
                style={{
                  height: `${Math.max(8, l * 120)}%`,
                  background: playing ? "var(--accent)" : "var(--line-strong)",
                }}
              />
            ))
          : Array.from({ length: 64 }).map((_, i) => (
              <i key={i} className="shimmer" style={{ height: `${20 + ((i * 5) % 55)}%` }} />
            ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="w-11 h-11 rounded-full grid place-items-center bg-accent text-black shadow-btn hover:brightness-110 transition-all active:scale-95"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1.5" width="3" height="9" rx="0.8" />
              <rect x="7" y="1.5" width="3" height="9" rx="0.8" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2.5 1.5v9l7.5-4.5-7.5-4.5z" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <div className="h-1 rounded-full bg-line-strong overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${Math.min(100, (t / dur) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 font-mono text-[11px] text-ink-3 tabular-nums">
            <span>{fmtTime(t)}</span>
            <span>{fmtTime(dur)}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-2">
          Chords · {track.params.key} {track.params.mode}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {track.chords.map((c, i) => (
            <span key={i} className="chip">{c}</span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <a href={url} download className="btn btn-ghost flex-1 justify-center !text-[12.5px]">
          WAV ↓
        </a>
        <a href={track.midi} download className="btn btn-ghost flex-1 justify-center !text-[12.5px]">
          MIDI ↓
        </a>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={url} preload="auto" className="hidden" />
    </div>
  );
}
