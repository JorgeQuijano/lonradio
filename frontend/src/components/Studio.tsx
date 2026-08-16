/* Studio — the six control sections (numbered cards, beautifului style). */

import {
  BASS_STYLES,
  CHORD_EXTS,
  DRUM_STYLES,
  KEYS,
  MELODY_STYLES,
  MODES,
  PROGRESSIONS,
  VOICINGS,
  type TrackParams,
} from "../types";
import { Section } from "./Section";
import { SelectField, SegmentedField, SliderField } from "./controls";

function jsonOf(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}

export function Studio({
  params,
  set,
}: {
  params: TrackParams;
  set: (patch: Partial<TrackParams>) => void;
}) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <Section
        num="01"
        title="Harmony"
        subtitle="Key, mood and how chords move — the bed everything sits on."
        code={jsonOf({
          key: params.key, mode: params.mode, progression: params.progression,
          chord_ext: params.chord_ext, voicing: params.voicing,
          bpm: params.bpm, bars: params.bars,
        })}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <SelectField label="Key" value={params.key} options={KEYS} onChange={(v) => set({ key: v })} />
          <SegmentedField label="Mode" value={params.mode} options={MODES} onChange={(v) => set({ mode: v })} />
          <SelectField
            label="Progression"
            value={params.progression}
            options={PROGRESSIONS}
            onChange={(v) => set({ progression: v })}
          />
          <SelectField
            label="Chord color"
            value={params.chord_ext}
            options={CHORD_EXTS}
            onChange={(v) => set({ chord_ext: v })}
          />
          <SelectField
            label="Voicing"
            value={params.voicing}
            options={VOICINGS}
            onChange={(v) => set({ voicing: v })}
          />
          <SelectField label="Bars" value={String(params.bars)} options={["2","4","6","8","12","16","24","32"]} onChange={(v) => set({ bars: Number(v) })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <SliderField label="Tempo" value={params.bpm} min={40} max={140} step={1} onChange={(v) => set({ bpm: v })} format={(v) => `${v} bpm`} />
        </div>
      </Section>

      <Section
        num="02"
        title="Bass"
        subtitle="The low end — five styles, from lazy eighths to walking lines."
        code={jsonOf({ bass_style: params.bass_style, swing: params.swing })}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Bass style"
            value={params.bass_style}
            options={BASS_STYLES}
            onChange={(v) => set({ bass_style: v })}
          />
          <SliderField label="Swing" value={params.swing} min={0} max={0.5} step={0.01} onChange={(v) => set({ swing: v })} format={(v) => v.toFixed(2)} />
        </div>
      </Section>

      <Section
        num="03"
        title="Drums"
        subtitle="Kick, snare, hats — synthesized, never sampled."
        code={jsonOf({ drums: params.drums, swing: params.swing })}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label="Pattern" value={params.drums} options={DRUM_STYLES} onChange={(v) => set({ drums: v })} />
          <SliderField label="Groove swing" value={params.swing} min={0} max={0.5} step={0.01} onChange={(v) => set({ swing: v })} format={(v) => v.toFixed(2)} />
        </div>
      </Section>

      <Section
        num="04"
        title="Melody"
        subtitle="A pentatonic wanderer over the changes — or none, if it's late."
        code={jsonOf({ melody: params.melody })}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label="Melody" value={params.melody} options={MELODY_STYLES} onChange={(v) => set({ melody: v })} />
        </div>
      </Section>

      <Section
        num="05"
        title="Tone & Seed"
        subtitle="The electric piano's tine brightness, and the reproducibility seed."
        code={jsonOf({ ep_tone: params.ep_tone, seed: params.seed })}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SliderField label="EP tine" value={params.ep_tone} min={0} max={1} step={0.01} onChange={(v) => set({ ep_tone: v })} format={(v) => (v < 0.35 ? "felt" : v > 0.65 ? "bright" : "warm")} />
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-3">Seed</span>
            <div className="flex gap-2">
              <input
                type="number"
                className="control w-full px-2.5 py-1.5"
                value={params.seed}
                min={0}
                max={4294967295}
                onChange={(e) => set({ seed: Math.max(0, Number(e.target.value) || 0) })}
              />
              <button
                type="button"
                className="btn btn-ghost !px-3"
                title="Random seed"
                onClick={() => set({ seed: Math.floor(Math.random() * 99999) })}
              >
                🎲
              </button>
            </div>
          </label>
        </div>
      </Section>

      <Section
        num="06"
        title="FX & Master"
        subtitle="Vinyl, tape, blanket and pump — the part that makes it lo-fi."
        code={jsonOf({
          fx_crackle: params.fx_crackle, fx_wobble: params.fx_wobble,
          fx_lowpass: params.fx_lowpass, fx_saturation: params.fx_saturation,
          fx_reverb: params.fx_reverb, fx_pump: params.fx_pump,
        })}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SliderField label="Vinyl crackle" value={params.fx_crackle} min={0} max={1} step={0.01} onChange={(v) => set({ fx_crackle: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderField label="Tape wobble" value={params.fx_wobble} min={0} max={1} step={0.01} onChange={(v) => set({ fx_wobble: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderField label="Lowpass blanket" value={params.fx_lowpass} min={0} max={1} step={0.01} onChange={(v) => set({ fx_lowpass: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderField label="Tape saturation" value={params.fx_saturation} min={0} max={1} step={0.01} onChange={(v) => set({ fx_saturation: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderField label="Reverb" value={params.fx_reverb} min={0} max={1} step={0.01} onChange={(v) => set({ fx_reverb: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderField label="Sidechain pump" value={params.fx_pump} min={0} max={1} step={0.01} onChange={(v) => set({ fx_pump: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
      </Section>
    </div>
  );
}
