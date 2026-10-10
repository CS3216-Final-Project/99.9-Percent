import { frequency } from "./score";
import { envelope, filter, hissBuffer, hit, loudness, noise, onUserGesture, osc, realtimeAudio } from "./synth";

/*
 * Short sound effects for what happens in the game, synthesised as they play
 * with the same building blocks as the music. Each cue is a fraction of a
 * second, written in the music's key so the two sit together.
 *
 * The effects have their own audio context: the music suspends and closes its
 * own, which must not cut an effect off. Like the music, the first click or
 * key press starts it; where the Web Audio API is missing, as in tests, every
 * cue is silently skipped.
 */

type Ctx = BaseAudioContext;
type Voice = (ctx: Ctx, out: AudioNode, at: number, hiss: AudioBuffer) => void;

const note = (midi: number) => frequency(midi);

/** Quick pitched blip: inspecting, hints, assigning engineers. */
const blip: Voice = (ctx, out, at) => {
  const o = osc(ctx, "triangle", note(88), at, at + 0.1);
  o.frequency.setValueAtTime(note(88), at);
  o.frequency.exponentialRampToValueAtTime(note(91), at + 0.04);
  o.connect(hit(ctx, at, 0.28, 0.09)).connect(out);
};

/** Square-wave notes, one after another: the chiptune voice of most cues. */
function run(ctx: Ctx, out: AudioNode, at: number, midis: number[], gap: number, peak: number, decay: number, cutoff = 3200): void {
  const lp = filter(ctx, "lowpass", cutoff);
  lp.connect(out);
  midis.forEach((m, i) => {
    const t = at + i * gap;
    osc(ctx, "square", note(m), t, t + decay + 0.02).connect(hit(ctx, t, peak, decay)).connect(lp);
  });
}

/** A bell: a sine with a quiet octave above it, ringing on. */
function bell(ctx: Ctx, out: AudioNode, at: number, midi: number, peak: number, decay: number): void {
  osc(ctx, "sine", note(midi), at, at + decay + 0.05).connect(hit(ctx, at, peak, decay)).connect(out);
  osc(ctx, "sine", note(midi + 12), at, at + decay / 2 + 0.05).connect(hit(ctx, at, peak * 0.3, decay / 2)).connect(out);
}

const VOICES = {
  /** An incident opens: two rising siren whoops over a low hit. */
  alarm: (ctx, out, at) => {
    const lp = filter(ctx, "lowpass", 2400);
    lp.connect(out);
    for (const t of [at, at + 0.26]) {
      const o = osc(ctx, "square", 660, t, t + 0.24);
      o.frequency.setValueAtTime(660, t);
      o.frequency.exponentialRampToValueAtTime(990, t + 0.2);
      o.connect(envelope(ctx, t, 0.24, 0.13, 0.02, 0.06)).connect(lp);
    }
    osc(ctx, "triangle", note(45), at, at + 0.4).connect(hit(ctx, at, 0.45, 0.35)).connect(out);
  },
  /** The incident is over: a bright rising chime over a soft major chord. */
  relief: (ctx, out, at) => {
    [79, 84, 88, 91].forEach((m, i) => bell(ctx, out, at + i * 0.09, m, 0.2, 0.9));
    for (const m of [60, 64, 67]) osc(ctx, "triangle", note(m), at, at + 1).connect(envelope(ctx, at, 1, 0.05, 0.1, 0.5)).connect(out);
  },
  /** A postmortem the player did not win: two falling notes over a low one. */
  review: (ctx, out, at) => {
    const lp = filter(ctx, "lowpass", 1800);
    lp.connect(out);
    osc(ctx, "triangle", note(76), at, at + 0.3).connect(envelope(ctx, at, 0.28, 0.16, 0.01, 0.1)).connect(lp);
    osc(ctx, "triangle", note(72), at + 0.24, at + 0.8).connect(envelope(ctx, at + 0.24, 0.55, 0.16, 0.01, 0.3)).connect(lp);
    osc(ctx, "sine", note(57), at, at + 0.8).connect(envelope(ctx, at, 0.8, 0.12, 0.05, 0.4)).connect(out);
  },
  /** Something new is ready: a quick arpeggio with a sparkle on top. */
  unlock: (ctx, out, at) => {
    run(ctx, out, at, [72, 76, 79, 84, 88], 0.055, 0.12, 0.22);
    bell(ctx, out, at + 0.28, 96, 0.06, 0.5);
  },
  /** A recovery step worked. */
  success: (ctx, out, at) => run(ctx, out, at, [79, 84, 88], 0.06, 0.13, 0.12),
  /** A recovery step did not help: a muffled two-note drop. */
  failure: (ctx, out, at) => run(ctx, out, at, [64, 60], 0.11, 0.2, 0.16, 1100),
  /** A week in the black: a coin. */
  weekUp: (ctx, out, at) => run(ctx, out, at, [83, 88], 0.06, 0.11, 0.24, 4000),
  /** A week in the red: a soft sliding sigh. */
  weekDown: (ctx, out, at) => {
    const o = osc(ctx, "triangle", note(64), at, at + 0.32);
    o.frequency.setValueAtTime(note(64), at);
    o.frequency.exponentialRampToValueAtTime(note(57), at + 0.28);
    o.connect(envelope(ctx, at, 0.32, 0.14, 0.01, 0.15)).connect(out);
  },
  /** A promotion launches: a rising whoosh. */
  promo: (ctx, out, at, hiss) => {
    const bp = filter(ctx, "bandpass", 500);
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(500, at);
    bp.frequency.exponentialRampToValueAtTime(4000, at + 0.32);
    noise(ctx, at, at + 0.4, hiss).connect(bp).connect(envelope(ctx, at, 0.4, 0.5, 0.12, 0.2)).connect(out);
    run(ctx, out, at + 0.2, [79, 84], 0.07, 0.08, 0.14);
  },
  /** An engineer joins: a friendly three-note hello. */
  hire: (ctx, out, at) => {
    [72, 76, 79].forEach((m, i) => {
      const t = at + i * 0.07;
      osc(ctx, "triangle", note(m), t, t + 0.25).connect(hit(ctx, t, 0.26, 0.22)).connect(out);
    });
    bell(ctx, out, at + 0.14, 84, 0.06, 0.3);
  },
  /** A server goes in or out of the rack: a heavy thump and a latch. */
  clunk: (ctx, out, at, hiss) => {
    const o = osc(ctx, "sine", 120, at, at + 0.2);
    o.frequency.setValueAtTime(120, at);
    o.frequency.exponentialRampToValueAtTime(50, at + 0.08);
    o.connect(hit(ctx, at, 0.45, 0.18)).connect(out);
    noise(ctx, at, at + 0.1, hiss).connect(filter(ctx, "lowpass", 900)).connect(hit(ctx, at, 0.25, 0.08)).connect(out);
    noise(ctx, at, at + 0.03, hiss).connect(filter(ctx, "highpass", 3500)).connect(hit(ctx, at, 0.12, 0.02)).connect(out);
    noise(ctx, at + 0.07, at + 0.11, hiss).connect(filter(ctx, "bandpass", 2000)).connect(hit(ctx, at + 0.07, 0.14, 0.03)).connect(out);
  },
  /** A decision is accepted: two short high notes. */
  confirm: (ctx, out, at) => run(ctx, out, at, [81, 88], 0.05, 0.13, 0.08, 3500),
  /** Not allowed: a low, soft buzz. */
  buzz: (ctx, out, at) => {
    const lp = filter(ctx, "lowpass", 700);
    lp.connect(envelope(ctx, at, 0.16, 0.09, 0.005, 0.05)).connect(out);
    osc(ctx, "square", 98, at, at + 0.17).connect(lp);
    osc(ctx, "square", 104, at, at + 0.17).connect(lp);
  },
  blip,
  /** The effects volume slider moved: the blip, at the new volume. */
  preview: blip,
  /** The run is won: a fanfare. */
  won: (ctx, out, at) => {
    run(ctx, out, at, [72, 76, 79], 0.1, 0.12, 0.12);
    for (const m of [84, 88, 91]) {
      osc(ctx, "square", note(m), at + 0.3, at + 1.1).connect(filter(ctx, "lowpass", 3000)).connect(envelope(ctx, at + 0.3, 0.8, 0.06, 0.02, 0.45)).connect(out);
      osc(ctx, "triangle", note(m - 12), at + 0.3, at + 1.1).connect(envelope(ctx, at + 0.3, 0.8, 0.08, 0.02, 0.45)).connect(out);
    }
  },
  /** The run is lost: a slow sad slide down, wobbling at the end. */
  lost: (ctx, out, at) => {
    const lp = filter(ctx, "lowpass", 1200);
    lp.connect(out);
    [67, 66, 65].forEach((m, i) => {
      const t = at + i * 0.26;
      osc(ctx, "square", note(m), t, t + 0.24).connect(envelope(ctx, t, 0.24, 0.13, 0.02, 0.08)).connect(lp);
    });
    const t = at + 0.78;
    const last = osc(ctx, "square", note(64), t, t + 0.7);
    const wobble = osc(ctx, "sine", 5, t, t + 0.7);
    const depth = ctx.createGain();
    depth.gain.value = 30;
    wobble.connect(depth).connect(last.detune);
    last.connect(envelope(ctx, t, 0.7, 0.13, 0.02, 0.3)).connect(lp);
  },
} satisfies Record<string, Voice>;

export type Cue = keyof typeof VOICES;
export const CUE_NAMES = Object.keys(VOICES) as Cue[];

/**
 * Shortest gap between two plays of the same cue, in milliseconds. Stings
 * never stack; small blips may repeat quickly but not into a drone.
 */
const GAP: Record<Cue, number> = {
  alarm: 1500,
  relief: 1500,
  review: 1500,
  won: 3000,
  lost: 3000,
  unlock: 600,
  weekUp: 300,
  weekDown: 300,
  success: 150,
  failure: 150,
  promo: 300,
  hire: 200,
  clunk: 150,
  confirm: 100,
  buzz: 200,
  blip: 70,
  preview: 120,
};

/** Bus gain at full volume. The default 80% gives about 0.58. */
const PEAK = 0.9;
/** A cue that cannot start this soon after it was asked for is dropped, so a late wake-up never plays a pile of old sounds. */
const FRESH_MS = 250;
/** Seconds to follow a volume slider. */
const SLIDE = 0.05;

export interface Sfx {
  /** Play a cue now, unless the sound is off or the same cue has only just played. */
  play(cue: Cue): void;
  /** The player's effects volume, 0 to 100; 0 when muted. At 0 the audio is suspended. */
  setVolume(percent: number): void;
  /** Stop for good and release the audio device. */
  dispose(): void;
}

const SILENT: Sfx = { play() {}, setVolume() {}, dispose() {} };

/**
 * `wanted` says whether the player has effects on, so a click can start the
 * audio before the first cue. `now` is the clock for the gaps between cues.
 */
export function createSfx(wanted: () => boolean = () => false, now: () => number = () => performance.now()): Sfx {
  const Available = realtimeAudio();
  if (!Available) return SILENT;
  const AudioCtor: typeof AudioContext = Available;

  let ctx: AudioContext | null = null;
  let bus: GainNode | null = null;
  let hiss: AudioBuffer | null = null;
  let percent = 0;
  let disposed = false;
  let sleep = 0;
  let warned = false;
  const last = new Map<Cue, number>();

  function start(): AudioContext {
    if (ctx) return ctx;
    const c = new AudioCtor();
    // A gentle limiter, so two cues landing together never clip.
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    limiter.connect(c.destination);
    const g = c.createGain();
    g.gain.value = loudness(percent, PEAK);
    g.connect(limiter);
    ctx = c;
    bus = g;
    hiss = hissBuffer(c);
    return c;
  }

  const stopListening = onUserGesture(() => {
    if (disposed || !(percent > 0 || wanted())) return;
    const c = start();
    if (c.state === "suspended") c.resume().catch(() => {});
  });

  function sound(c: AudioContext, cue: Cue): void {
    if (!bus || !hiss) return;
    try {
      VOICES[cue](c, bus, c.currentTime + 0.005, hiss);
    } catch (error) {
      if (!warned) console.warn("A sound effect could not be played; the game carries on without it.", error);
      warned = true;
    }
  }

  return {
    play(cue) {
      if (disposed || percent <= 0) return;
      const t = now();
      if (t - (last.get(cue) ?? -Infinity) < GAP[cue]) return;
      last.set(cue, t);
      const c = start();
      if (c.state === "running") {
        sound(c, cue);
        return;
      }
      // Anything scheduled on a sleeping context would start all at once when it wakes: play this only if it wakes promptly.
      c.resume()
        .then(() => {
          if (ctx === c && !disposed && percent > 0 && now() - t < FRESH_MS) sound(c, cue);
        })
        .catch(() => {});
    },
    setVolume(next) {
      if (disposed) return;
      percent = next;
      window.clearTimeout(sleep);
      if (!ctx || !bus) return;
      const gain = loudness(next, PEAK);
      const at = ctx.currentTime;
      bus.gain.cancelScheduledValues(at);
      bus.gain.setValueAtTime(bus.gain.value, at);
      bus.gain.linearRampToValueAtTime(gain, at + SLIDE);
      const c = ctx;
      if (gain > 0) {
        if (c.state === "suspended") c.resume().catch(() => {});
      } else sleep = window.setTimeout(() => c.suspend().catch(() => {}), 400);
    },
    dispose() {
      disposed = true;
      window.clearTimeout(sleep);
      stopListening();
      ctx?.close().catch(() => {});
      ctx = null;
      bus = null;
      hiss = null;
    },
  };
}

/** Render one cue offline at full volume, for checking levels in a browser. */
export async function renderCue(cue: Cue, rate = 44100): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.round(rate * 2), rate);
  VOICES[cue](ctx, ctx.destination, 0.01, hissBuffer(ctx));
  return ctx.startRendering();
}
