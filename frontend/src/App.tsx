import { useCallback, useEffect, useState } from "react";
import { fetchPresets, generateTrack } from "./api";
import { Hero } from "./components/Hero";
import { Player } from "./components/Player";
import { Sidebar } from "./components/Sidebar";
import { Studio } from "./components/Studio";
import { TopBar } from "./components/TopBar";
import { DEFAULT_PARAMS, type GenerateResult, type Presets, type TrackParams } from "./types";
import { useMediaQuery } from "./useMediaQuery";

export default function App() {
  const [params, setParams] = useState<TrackParams>(DEFAULT_PARAMS);
  const [presets, setPresets] = useState<Presets>({});
  const [track, setTrack] = useState<GenerateResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWide = useMediaQuery("(min-width: 1280px)");

  useEffect(() => {
    fetchPresets()
      .then(setPresets)
      .catch(() => setPresets({}));
  }, []);

  const set = useCallback((patch: Partial<TrackParams>) => {
    setParams((p) => ({ ...p, ...patch }));
  }, []);

  const randomize = useCallback(() => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setParams((p) => ({
      ...p,
      key: pick(["C", "D", "E", "F", "G", "A", "Bb", "Eb"]),
      mode: pick(["minor", "minor", "major"]),
      bpm: 66 + Math.floor(Math.random() * 30),
      bars: pick([4, 8, 8, 12]),
      progression: pick(["classic", "soulful", "jazzy", "dreamy"]),
      chord_ext: pick(["7", "9", "9", "add9"]),
      voicing: pick(["spread", "spread", "drop2"]),
      bass_style: pick(["root-eighths", "walk", "octave-bounce", "syncopated", "pedal"]),
      drums: pick(["boom-bap", "boom-bap", "brushed", "four-floor"]),
      swing: Math.round(Math.random() * 40) / 100,
      melody: pick(["sparse", "flowing", "none"]),
      ep_tone: Math.round(Math.random() * 100) / 100,
      fx_crackle: Math.round(Math.random() * 100) / 100,
      fx_wobble: Math.round(Math.random() * 80) / 100,
      fx_lowpass: Math.round(Math.random() * 100) / 100,
      fx_saturation: Math.round(Math.random() * 80) / 100,
      fx_reverb: Math.round(Math.random() * 70) / 100,
      fx_pump: Math.round(Math.random() * 70) / 100,
      seed: Math.floor(Math.random() * 99999),
    }));
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const r = await generateTrack(params);
      setTrack(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [params]);

  const wavUrl = track ? track.wav : null;

  return (
    <div className="min-h-screen bg-page text-ink">
      <TopBar />
      <Hero onGenerate={() => void generate()} onRandomize={randomize} generating={generating} params={params} />

      <main className="max-w-[1200px] mx-auto px-5 pb-20">
        <div className="flex gap-8">
          <Sidebar presets={presets} onPreset={(p) => setParams((cur) => ({ ...cur, ...p }))} />
          <div className="flex-1 min-w-0 flex flex-col gap-5">
            <Studio params={params} set={set} />

            {error && (
              <div className="card border border-bad-tint p-4 text-[13px] text-bad">
                Generation failed: {error}
              </div>
            )}

            <div className="xl:hidden">
              {!isWide && <Player track={track} url={wavUrl} />}
            </div>

            {/* sticky generate bar (beautifului-style primary CTA row) */}
            <div className="sticky bottom-4 z-30">
              <div className="card-inset border border-line px-4 py-3 flex items-center justify-between gap-4 shadow-overlay">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">
                    {track ? track.name : "Ready when you are."}
                  </p>
                  <p className="text-[11.5px] text-ink-3 font-mono truncate">
                    {track
                      ? `${track.chords.join(" · ")} — ${track.duration_s}s · seed ${track.params.seed}`
                      : `${params.key} ${params.mode} · ${params.bpm} bpm · ${params.bars} bars · seed ${params.seed}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary shrink-0 !px-5"
                  onClick={() => void generate()}
                  disabled={generating}
                >
                  {generating ? "Churning…" : track ? "Re-generate" : "Generate"}
                </button>
              </div>
            </div>
          </div>

          <div className="hidden xl:block w-[340px] shrink-0">
            <div className="sticky top-20">
              {isWide && <Player track={track} url={wavUrl} />}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-line py-8">
        <div className="max-w-[1200px] mx-auto px-5 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-3">
          <p>
            Built for <span className="text-ink-2">lonradio</span> — algorithmic
            lo-fi out of London, ON. Engine: music21 · numpy · pedalboard · FastAPI.
          </p>
          <p className="font-mono text-[11px]">same seed → same track, forever</p>
        </div>
      </footer>
    </div>
  );
}
