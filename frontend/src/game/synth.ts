/*
 * Building blocks shared by the music (music.ts) and the sound effects
 * (sfx.ts): a few Web Audio nodes wired up the same way for both, the volume
 * curve for the settings sliders, and the click that lets a page make sound.
 */

type Ctx = BaseAudioContext;

export function envelope(ctx: Ctx, at: number, length: number, peak: number, attack: number, release: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setValueAtTime(peak, Math.max(at + attack, at + length - release));
  g.gain.linearRampToValueAtTime(0, at + length);
  return g;
}

/** A sound that starts loud and dies away. */
export function hit(ctx: Ctx, at: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  return g;
}

export function filter(ctx: Ctx, type: BiquadFilterType, hz: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  return f;
}

export function osc(ctx: Ctx, type: OscillatorType, hz: number, at: number, stop: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  o.detune.value = detune;
  o.start(at);
  o.stop(stop);
  return o;
}

export function noise(ctx: Ctx, at: number, stop: number, buffer: AudioBuffer): AudioBufferSourceNode {
  const n = ctx.createBufferSource();
  n.buffer = buffer;
  n.start(at, Math.random() * 0.5);
  n.stop(stop);
  return n;
}

/** A second of white noise, the raw material for drums, clunks and whooshes. */
export function hissBuffer(ctx: Ctx, rate = ctx.sampleRate): AudioBuffer {
  const hiss = ctx.createBuffer(1, rate, rate);
  const data = hiss.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return hiss;
}

/**
 * Gain for a volume slider at `percent`: squared, so each step sounds about as
 * big as the last, reaching `peak` at 100%.
 */
export function loudness(percent: number, peak: number): number {
  const level = Math.min(1, Math.max(0, Number.isFinite(percent) ? percent / 100 : 0));
  return peak * level * level;
}

/** The browser's realtime audio, or undefined where there is none (tests, audio disabled). */
export function realtimeAudio(): typeof AudioContext | undefined {
  return typeof window === "undefined" ? undefined : window.AudioContext;
}

/**
 * Browsers only let a page start audio from inside a click or key press, and
 * Safari only from the handler itself. Calls `wake` on each one; returns the
 * cleanup. `click` and `keyup` come after the game has reacted to the press,
 * so a press that unmutes can also start the audio it asked for.
 */
export function onUserGesture(wake: () => void): () => void {
  const events = ["pointerdown", "keydown", "click", "keyup"] as const;
  for (const e of events) window.addEventListener(e, wake);
  return () => {
    for (const e of events) window.removeEventListener(e, wake);
  };
}
