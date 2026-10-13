import { rand, randRange, type RngHolder } from "@/sim/rng";
import { filter, loudness, onUserGesture, realtimeAudio } from "./synth";

/*
 * The sound of the city outside, under the game: by day birds in the trees, a breeze and the traffic's hum; at night
 * crickets, and quieter traffic with a car going by now and then. On the server floor the city gives way to the
 * hall's fans and the hum of its power, louder as the servers work harder. Like the music (music.ts), each is synthesised
 * once, off the main audio thread, into a buffer that plays on repeat, and the two crossfade as it gets dark (see
 * scene/sky.ts). It follows the sound-effects volume, since it is the world's sound rather than the score's, and
 * plays only while a run is on screen. Where the Web Audio API is missing, as in tests, there is none.
 *
 * What happens in each loop is plain data from a seeded generator, so it is the same every time and can be tested.
 */

export interface Ambience {
  /** A run is on screen. Off fades out and suspends the audio. */
  setEnabled(on: boolean): void;
  /** The player's effects volume, 0 to 100; 0 when muted. */
  setVolume(percent: number): void;
  /** How dark it is outside, 0 in broad day to 1 in deep night. */
  setDark(dark: number): void;
  /**
   * How much of the server hall is heard instead of the city, 0 with the office in view to 1 on the server floor
   * under full load, reached over `seconds`.
   */
  setHall(level: number, seconds?: number): void;
  dispose(): void;
}

/** Seconds in each loop. Long enough that its birds and passing cars do not seem to repeat. */
export const LOOP_SECONDS = 24;
/** Samples a second: the crickets' 4.6 kHz needs a little more than twice that. */
const RATE = 22050;
/** Overall loudness at full effects volume: a background, under the effects themselves. */
const PEAK = 0.4;
const FADE = 1.2;

/** One sound in a loop: when it starts, how long it lasts, and its own settings. */
export type Event =
  | { kind: "chirp"; at: number; length: number; from: number; to: number; gain: number }
  | { kind: "trill"; at: number; length: number; hz: number; rate: number; gain: number }
  | { kind: "cricket"; at: number; length: number; hz: number; pulses: number; gain: number }
  | { kind: "car"; at: number; length: number; gain: number };

/** Birdsong: phrases of rising and falling chirps, with a trill now and then, from a few birds at different pitches. */
export function dayEvents(seed = 61): Event[] {
  const rng: RngHolder = { rngState: seed };
  const out: Event[] = [];
  const birds = [2600, 3400, 4300];
  for (let t = randRange(rng, 0.3, 1.5); t < LOOP_SECONDS - 2; t += randRange(rng, 1.4, 3.6)) {
    const base = birds[Math.floor(rand(rng) * birds.length)];
    if (rand(rng) < 0.25) {
      out.push({ kind: "trill", at: t, length: randRange(rng, 0.35, 0.7), hz: base * 1.1, rate: randRange(rng, 18, 28), gain: randRange(rng, 0.25, 0.45) });
      continue;
    }
    const notes = Math.floor(randRange(rng, 2, 6));
    let at = t;
    for (let k = 0; k < notes; k++) {
      const up = rand(rng) < 0.6;
      const length = randRange(rng, 0.06, 0.16);
      out.push({ kind: "chirp", at, length, from: base * (up ? 0.8 : 1.25), to: base * (up ? 1.3 : 0.85), gain: randRange(rng, 0.3, 0.6) });
      at += length + randRange(rng, 0.04, 0.12);
    }
  }
  for (let t = randRange(rng, 2, 5); t < LOOP_SECONDS - 3; t += randRange(rng, 5, 9)) out.push({ kind: "car", at: t, length: randRange(rng, 3, 4.5), gain: randRange(rng, 0.5, 0.8) });
  return out;
}

/** Two crickets chirping in their own rhythms, and a car going by once or twice. */
export function nightEvents(seed = 67): Event[] {
  const rng: RngHolder = { rngState: seed };
  const out: Event[] = [];
  for (const [hz, every, gain] of [
    [4600, 0.62, 0.5],
    [4150, 0.83, 0.35],
  ] as const) {
    for (let t = randRange(rng, 0, every); t < LOOP_SECONDS - 0.3; t += every * randRange(rng, 0.92, 1.08)) {
      out.push({ kind: "cricket", at: t, length: 0.16, hz, pulses: 3, gain: gain * randRange(rng, 0.85, 1.05) });
    }
  }
  for (let t = randRange(rng, 4, 8); t < LOOP_SECONDS - 4; t += randRange(rng, 10, 14)) out.push({ kind: "car", at: t, length: randRange(rng, 3.5, 5), gain: randRange(rng, 0.3, 0.45) });
  return out;
}

/** How loud each loop plays at a given darkness: day fades out and night in, mostly through dusk, and never both silent. */
export function mix(dark: number): { day: number; night: number } {
  const d = Math.min(1, Math.max(0, dark));
  const s = d * d * (3 - 2 * d);
  return { day: Math.cos((s * Math.PI) / 2), night: Math.sin((s * Math.PI) / 2) };
}

/** How loud the day, the night and the server hall play: the hall takes over from the city as it rises. */
export function blend(dark: number, hall: number): { day: number; night: number; hall: number } {
  const h = Math.min(1, Math.max(0, hall));
  const city = mix(dark);
  return { day: city.day * (1 - h), night: city.night * (1 - h), hall: h };
}

type Ctx = BaseAudioContext;

/** A buffer of noise from the seeded generator: the city's hum, the breeze and the tyres of passing cars. */
function noiseBuffer(ctx: Ctx, seconds: number, rng: RngHolder): AudioBuffer {
  const b = ctx.createBuffer(1, Math.round(seconds * RATE), RATE);
  const data = b.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rand(rng) * 2 - 1;
  return b;
}

function source(ctx: Ctx, buffer: AudioBuffer, at = 0, stop = LOOP_SECONDS): AudioBufferSourceNode {
  const n = ctx.createBufferSource();
  n.buffer = buffer;
  n.loop = true;
  n.start(at);
  n.stop(stop);
  return n;
}

function play(ctx: Ctx, out: AudioNode, hiss: AudioBuffer, e: Event): void {
  const g = ctx.createGain();
  const end = e.at + e.length;
  g.connect(out);
  switch (e.kind) {
    case "chirp": {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(e.from, e.at);
      o.frequency.exponentialRampToValueAtTime(e.to, end);
      g.gain.setValueAtTime(0, e.at);
      g.gain.linearRampToValueAtTime(e.gain * 0.18, e.at + e.length * 0.25);
      g.gain.linearRampToValueAtTime(0, end);
      o.connect(g);
      o.start(e.at);
      o.stop(end);
      break;
    }
    case "trill": {
      const o = ctx.createOscillator();
      o.frequency.value = e.hz;
      const flutter = ctx.createOscillator();
      flutter.type = "square";
      flutter.frequency.value = e.rate;
      const depth = ctx.createGain();
      depth.gain.value = e.gain * 0.07;
      g.gain.value = e.gain * 0.07;
      flutter.connect(depth).connect(g.gain);
      const shape = ctx.createGain();
      shape.gain.setValueAtTime(0, e.at);
      shape.gain.linearRampToValueAtTime(1, e.at + 0.05);
      shape.gain.setValueAtTime(1, end - 0.08);
      shape.gain.linearRampToValueAtTime(0, end);
      o.connect(shape).connect(g);
      for (const n of [o, flutter]) {
        n.start(e.at);
        n.stop(end);
      }
      break;
    }
    case "cricket": {
      // A few quick pulses of a high, pure tone.
      const o = ctx.createOscillator();
      o.frequency.value = e.hz;
      const pulse = e.length / (e.pulses * 2);
      g.gain.setValueAtTime(0, e.at);
      for (let k = 0; k < e.pulses; k++) {
        const t = e.at + k * pulse * 2;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(e.gain * 0.06, t + pulse * 0.4);
        g.gain.linearRampToValueAtTime(0, t + pulse);
      }
      o.connect(g);
      o.start(e.at);
      o.stop(end);
      break;
    }
    case "car": {
      // Tyres on the road swelling and fading as a car passes, its pitch dropping a little as it goes.
      const band = filter(ctx, "bandpass", 500);
      band.Q.value = 0.7;
      band.frequency.setValueAtTime(700, e.at);
      band.frequency.linearRampToValueAtTime(420, end);
      g.gain.setValueAtTime(0, e.at);
      g.gain.linearRampToValueAtTime(e.gain * 0.22, e.at + e.length * 0.45);
      g.gain.linearRampToValueAtTime(0, end);
      source(ctx, hiss, e.at, end).connect(band).connect(g);
      break;
    }
  }
}

/**
 * Synthesise a loop: beds of filtered noise (the traffic's hum, by day a breeze, the hall's fans), steady tones (the
 * hall's mains hum) and the loop's events, brought to an even loudness (`level`, root mean square) so each sits where
 * it is meant to under the music.
 */
async function renderAmbience(events: Event[], beds: Bed[], tones: Tone[], seed: number, level: number): Promise<AudioBuffer> {
  const length = Math.round(LOOP_SECONDS * RATE);
  const ctx = new OfflineAudioContext(1, length, RATE);
  const rng: RngHolder = { rngState: seed };
  const hiss = noiseBuffer(ctx, 5, rng);
  const bus = ctx.createDynamicsCompressor();
  bus.connect(ctx.destination);
  const bed = (gain: number, type: BiquadFilterType, hz: number) => {
    if (gain <= 0) return;
    const g = ctx.createGain();
    g.gain.value = gain;
    source(ctx, hiss).connect(filter(ctx, type, hz)).connect(g).connect(bus);
  };
  for (const [type, hz, gain] of beds) bed(gain, type, hz);
  for (const [hz, gain] of tones) {
    const g = ctx.createGain();
    g.gain.value = gain;
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    o.connect(g).connect(bus);
    o.start(0);
    o.stop(LOOP_SECONDS);
  }
  for (const e of events) play(ctx, bus, hiss, e);
  const out = await ctx.startRendering();
  const data = out.getChannelData(0);
  let sum = 0;
  let peak = 0;
  for (const x of data) {
    sum += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  const rms = Math.sqrt(sum / data.length);
  if (rms > 0) {
    const k = Math.min(level / rms, 0.9 / peak);
    for (let i = 0; i < data.length; i++) data[i] *= k;
  }
  return out;
}

/** A bed of noise through a filter: its type, frequency and loudness. */
type Bed = [BiquadFilterType, number, number];
/** A steady tone: its frequency and loudness. */
type Tone = [number, number];

/** Each loop's events, beds and tones, the seed of its noise, and its overall level. */
const LOOPS: Record<"day" | "night" | "hall", { events: () => Event[]; beds: Bed[]; tones: Tone[]; seed: number; level: number }> = {
  // The traffic's low hum, and by day a breeze in the trees.
  day: { events: dayEvents, beds: [["lowpass", 220, 0.05], ["highpass", 2500, 0.012]], tones: [], seed: 71, level: 0.09 },
  night: { events: nightEvents, beds: [["lowpass", 220, 0.03]], tones: [], seed: 73, level: 0.06 },
  // The racks' fans as a broad whir over the cooling units' rumble, and the mains hum with its harmonics.
  hall: { events: () => [], beds: [["bandpass", 900, 0.07], ["lowpass", 260, 0.05]], tones: [[100, 0.02], [200, 0.008], [300, 0.004]], seed: 79, level: 0.08 },
};

/** Synthesise the day's loop, the night's or the server hall's. */
export function renderAmbienceLoop(which: keyof typeof LOOPS): Promise<AudioBuffer> {
  const l = LOOPS[which];
  return renderAmbience(l.events(), l.beds, l.tones, l.seed, l.level);
}

const SILENT: Ambience = { setEnabled() {}, setVolume() {}, setDark() {}, setHall() {}, dispose() {} };

/** `wanted` says whether the player has effects on, so a click can start the audio before the game asks for it. */
export function createAmbience(wanted: () => boolean = () => false): Ambience {
  const Available = realtimeAudio();
  if (!Available || typeof OfflineAudioContext === "undefined") return SILENT;
  const AudioCtor: typeof AudioContext = Available;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let day: GainNode | null = null;
  let night: GainNode | null = null;
  let hall: GainNode | null = null;
  const sources: AudioBufferSourceNode[] = [];
  let enabled = false;
  let percent = 0;
  let dark = 0;
  let indoors = 0;
  let disposed = false;
  let sleep = 0;

  const ramp = (p: AudioParam, to: number, seconds: number) => {
    if (!ctx) return;
    const now = ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(to, now + seconds);
  };

  const stopListening = onUserGesture(() => {
    if (disposed || !((enabled && percent > 0) || wanted())) return;
    const c = start();
    if (c.state === "suspended") c.resume().catch(() => {});
  });

  function start(): AudioContext {
    if (ctx) return ctx;
    const c = new AudioCtor();
    ctx = c;
    master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);
    const lanes = blend(dark, indoors);
    day = c.createGain();
    day.gain.value = lanes.day;
    day.connect(master);
    night = c.createGain();
    night.gain.value = lanes.night;
    night.connect(master);
    hall = c.createGain();
    hall.gain.value = lanes.hall;
    hall.connect(master);
    (async () => {
      for (const [lane, which] of [
        [day, "day"],
        [night, "night"],
        [hall, "hall"],
      ] as const) {
        const buffer = await renderAmbienceLoop(which);
        if (disposed || ctx !== c) return;
        const s = c.createBufferSource();
        s.buffer = buffer;
        s.loop = true;
        s.connect(lane);
        s.start();
        sources.push(s);
      }
    })().catch((error: unknown) => console.warn("The city's sound could not be prepared; the game carries on without it.", error));
    return c;
  }

  function apply(seconds: number): void {
    window.clearTimeout(sleep);
    const gain = enabled ? loudness(percent, PEAK) : 0;
    if (gain > 0) {
      start()
        .resume()
        .catch(() => {});
      if (master) ramp(master.gain, gain, seconds);
    } else if (ctx && master) {
      ramp(master.gain, 0, 0.3);
      const c = ctx;
      sleep = window.setTimeout(() => c.suspend().catch(() => {}), 400);
    }
  }

  return {
    setEnabled(on) {
      if (disposed) return;
      enabled = on;
      apply(FADE);
    },
    setVolume(next) {
      if (disposed) return;
      const from = percent;
      percent = next;
      if (enabled) apply(from > 0 ? 0.08 : FADE);
    },
    setDark(next) {
      dark = next;
      const lanes = blend(next, indoors);
      if (day) ramp(day.gain, lanes.day, 2);
      if (night) ramp(night.gain, lanes.night, 2);
    },
    setHall(level, seconds = 1.2) {
      if (Math.abs(level - indoors) < 1e-3) return;
      indoors = level;
      const lanes = blend(dark, level);
      if (day) ramp(day.gain, lanes.day, seconds);
      if (night) ramp(night.gain, lanes.night, seconds);
      if (hall) ramp(hall.gain, lanes.hall, seconds);
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
      master = day = night = hall = null;
    },
  };
}
