/* Hero — big type, mono eyebrow, primary + ghost CTAs, engine chips. */

import type { TrackParams } from "../types";

export function Hero({
  onGenerate,
  onRandomize,
  generating,
  params,
}: {
  onGenerate: () => void;
  onRandomize: () => void;
  generating: boolean;
  params: TrackParams;
}) {
  return (
    <section id="top" className="px-5 pt-14 pb-10 text-center">
      <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-ink-3 mb-4">
        algorithmic lo-fi · London ON
      </p>
      <h1 className="text-[44px] sm:text-[64px] leading-[1.02] font-semibold tracking-[-0.03em] text-ink max-w-3xl mx-auto">
        Code music,
        <br />
        <span className="bg-gradient-to-r from-accent via-accent-ink to-accent bg-clip-text text-transparent">
          not samples.
        </span>
      </h1>
      <p className="mt-5 text-[15px] text-ink-2 max-w-xl mx-auto leading-relaxed">
        Every track is composed and synthesized from math — chord progressions,
        bass styles, drums and vinyl texture — then rendered to WAV + MIDI by a
        Python engine. Or just press play on the 24/7 auto-DJ radio.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
        <button type="button" className="btn btn-primary !px-6 !py-2.5" onClick={onGenerate} disabled={generating}>
          {generating ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              Churning…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 1.5v9l7.5-4.5L2 1.5z" />
              </svg>
              Generate a track
            </>
          )}
        </button>
        <button type="button" className="btn btn-ghost !px-6 !py-2.5" onClick={onRandomize} disabled={generating}>
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1 9.5L9.5 1M9.5 1h-5M9.5 1v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Randomize
        </button>
      </div>
      <div className="mt-9 flex items-center justify-center gap-2 flex-wrap">
        <span className="chip chip-accent">{params.key} {params.mode}</span>
        <span className="chip">{params.bpm} bpm</span>
        <span className="chip">{params.bars} bars</span>
        <span className="chip">{params.bass_style}</span>
        <span className="chip">{params.drums}</span>
        <span className="chip">seed {params.seed}</span>
        <span className="chip">music21 + numpy + pedalboard</span>
      </div>
    </section>
  );
}
