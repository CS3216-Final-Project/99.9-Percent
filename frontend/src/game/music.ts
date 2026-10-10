import { compose, frequency, MOODS, secondsOf, type Mood, type Note, type Score } from "./score";
import { envelope, filter, hissBuffer, hit, loudness, noise, onUserGesture, osc, realtimeAudio } from "./synth";

/*
 * Plays the background music. Each loop in score.ts is synthesised once, off
 * the main audio thread, into a buffer that then plays on repeat; the two
 * loops run side by side and a change of mood crossfades between them.
 *
 * Browsers only let a page make sound after the player has interacted with it,
 * and the strictest (Safari) only start audio from inside the click itself. So
 * while music is wanted, the first click or key press (the title screen's Play
 * button) starts the audio, silent until a run is on screen. Where the Web Audio
 * API is missing, as in tests, there is no music and nothing fails.
 */

export interface Music {
  /** A run is on screen. Off fades out and suspends the audio. */
  setEnabled(on: boolean): void;
  /** The player's music volume, 0 to 100. At 0 the audio is suspended as if off. */
  setVolume(percent: number): void;
  setMood(mood: Mood): void;
  /** Stop for good and release the audio device. */
  dispose(): void;
}

/**
 * Overall loudness at full volume. Music sits under the game, not over it: the
 * default 80% plays at 0.32, the level it had before the volume slider.
 */
const PEAK = 0.5;
/** Seconds to fade between moods, and in or out. */
const CROSSFADE = 1.4;
const FADE_IN = 0.8;
const FADE_OUT = 0.3;
/** Seconds to follow a volume slider: quick, without clicks. */
const SLIDE = 0.08;
/** Samples a second for the loops: plenty for soft synths, at a third less memory than CD quality. */
const RATE = 32000;
/** Seconds rendered past the end of a loop, so notes ringing over the seam wrap round to its start. */
const TAIL = 1.5;

const SILENT: Music = { setEnabled() {}, setVolume() {}, setMood() {}, dispose() {} };

type Ctx = BaseAudioContext;

/** One note through its voice's synth, into out. */
function play(ctx: Ctx, out: AudioNode, hiss: AudioBuffer, n: Note, secondsPerBeat: number): void {
  const at = n.beat * secondsPerBeat;
  const length = n.beats * secondsPerBeat;
  const end = at + length;
  const hz = frequency(n.midi);
  switch (n.voice) {
    case "pad": {
      const g = envelope(ctx, at, length, n.gain * 0.09, Math.min(0.8, length / 3), Math.min(0.9, length / 3));
      const lp = filter(ctx, "lowpass", 1300);
      osc(ctx, "triangle", hz, at, end, -7).connect(lp);
      osc(ctx, "triangle", hz, at, end, 7).connect(lp);
      lp.connect(g).connect(out);
      break;
    }
    case "pluck": {
      const g = hit(ctx, at, n.gain * 0.12, 0.32);
      osc(ctx, "square", hz, at, at + 0.35).connect(filter(ctx, "lowpass", 2200)).connect(g).connect(out);
      break;
    }
    case "bass": {
      const g = envelope(ctx, at, length, n.gain * 0.3, 0.01, 0.06);
      osc(ctx, "triangle", hz, at, end).connect(g);
      osc(ctx, "sine", hz / 2, at, end).connect(g);
      g.connect(out);
      break;
    }
    case "kick": {
      const o = osc(ctx, "sine", 140, at, at + 0.35);
      o.frequency.setValueAtTime(140, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
      o.connect(hit(ctx, at, n.gain * 0.75, 0.32)).connect(out);
      break;
    }
    case "snare": {
      noise(ctx, at, at + 0.2, hiss).connect(filter(ctx, "bandpass", 1800)).connect(hit(ctx, at, n.gain * 0.45, 0.18)).connect(out);
      osc(ctx, "triangle", 185, at, at + 0.1).connect(hit(ctx, at, n.gain * 0.2, 0.08)).connect(out);
      break;
    }
    case "hat": {
      noise(ctx, at, at + 0.06, hiss).connect(filter(ctx, "highpass", 7000)).connect(hit(ctx, at, n.gain * 0.25, 0.05)).connect(out);
      break;
    }
    case "alarm": {
      const o = osc(ctx, "square", hz, at, end);
      const wobble = osc(ctx, "sine", 6, at, end);
      const depth = ctx.createGain();
      depth.gain.value = 18;
      wobble.connect(depth).connect(o.detune);
      o.connect(filter(ctx, "lowpass", 2600)).connect(envelope(ctx, at, length, n.gain * 0.07, 0.02, 0.08)).connect(out);
      break;
    }
  }
}

/** Synthesise a score into a buffer that loops without a seam. */
export async function renderLoop(score: Score, rate = RATE): Promise<AudioBuffer> {
  const seconds = secondsOf(score);
  const loop = Math.round(seconds * rate);
  const ctx = new OfflineAudioContext(1, loop + Math.round(TAIL * rate), rate);
  const hiss = hissBuffer(ctx, rate);
  const bus = ctx.createDynamicsCompressor();
  bus.connect(ctx.destination);
  for (const n of score.notes) play(ctx, bus, hiss, n, 60 / score.bpm);
  const rendered = await ctx.startRendering();
  // Fold the tail back onto the start, where it would ring on the next time round.
  const out = ctx.createBuffer(1, loop, rate);
  const src = rendered.getChannelData(0);
  const dst = out.getChannelData(0);
  dst.set(src.subarray(0, loop));
  for (let i = loop; i < src.length; i++) dst[i - loop] += src[i];
  return out;
}

/** `wanted` says whether the player has music on, so a click can start the audio before the game asks for it. */
export function createMusic(wanted: () => boolean = () => false): Music {
  const Available = realtimeAudio();
  if (!Available || typeof OfflineAudioContext === "undefined") return SILENT;
  const AudioCtor: typeof AudioContext = Available;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const lanes = new Map<Mood, GainNode>();
  const sources: AudioBufferSourceNode[] = [];
  let mood: Mood = "calm";
  let enabled = false;
  let percent = 0;
  let disposed = false;
  let sleep = 0;

  const fade = (g: GainNode, to: number, seconds: number) => {
    if (!ctx) return;
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(to, now + seconds);
  };

  // A click or key press is the moment audio is allowed to start: start it then, while music is wanted.
  const stopListening = onUserGesture(() => {
    if (disposed || !((enabled && percent > 0) || wanted())) return;
    const c = start();
    if (c.state === "suspended") c.resume().catch(() => {});
  });

  /** Fade towards the level the settings ask for, or out and to sleep. */
  function apply(seconds: number): void {
    window.clearTimeout(sleep);
    const gain = enabled ? loudness(percent, PEAK) : 0;
    if (gain > 0) {
      start()
        .resume()
        .catch(() => {});
      if (master) fade(master, gain, seconds);
    } else if (ctx && master) {
      fade(master, 0, FADE_OUT);
      const c = ctx;
      sleep = window.setTimeout(() => c.suspend().catch(() => {}), FADE_OUT * 1000 + 100);
    }
  }

  function start(): AudioContext {
    if (ctx) return ctx;
    const c = new AudioCtor();
    ctx = c;
    master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);
    for (const m of MOODS) {
      const lane = c.createGain();
      lane.gain.value = m === mood ? 1 : 0;
      lane.connect(master);
      lanes.set(m, lane);
    }
    (async () => {
      // The calm loop first: it is the one heard on arrival.
      for (const m of MOODS) {
        const buffer = await renderLoop(compose(m));
        if (disposed || ctx !== c) return;
        const source = c.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(lanes.get(m) as GainNode);
        source.start();
        sources.push(source);
      }
    })().catch((error: unknown) => console.warn("The music could not be prepared; the game carries on without it.", error));
    return c;
  }

  return {
    setEnabled(on) {
      if (disposed) return;
      enabled = on;
      apply(FADE_IN);
    },
    setVolume(next) {
      if (disposed) return;
      // Coming up from silence fades in like switching on; otherwise follow the slider.
      const from = percent;
      percent = next;
      if (enabled) apply(from > 0 ? SLIDE : FADE_IN);
    },
    setMood(next) {
      mood = next;
      for (const [m, lane] of lanes) fade(lane, m === next ? 1 : 0, CROSSFADE);
    },
    dispose() {
      disposed = true;
      window.clearTimeout(sleep);
      stopListening();
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      sources.length = 0;
      ctx?.close().catch(() => {});
      ctx = null;
      master = null;
      lanes.clear();
    },
  };
}
