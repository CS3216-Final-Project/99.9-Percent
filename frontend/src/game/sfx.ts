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
  /** A company starts: a rack powering up, a sweep that rises and settles into two bell notes. */
  launch: (ctx, out, at, hiss) => {
    const lp = filter(ctx, "lowpass", 300);
    lp.frequency.setValueAtTime(300, at);
    lp.frequency.exponentialRampToValueAtTime(2600, at + 0.34);
    const fan = osc(ctx, "sawtooth", note(36), at, at + 0.42);
    fan.frequency.setValueAtTime(note(36), at);
    fan.frequency.exponentialRampToValueAtTime(note(48), at + 0.34);
    fan.connect(lp).connect(envelope(ctx, at, 0.42, 0.1, 0.1, 0.12)).connect(out);
    noise(ctx, at, at + 0.36, hiss).connect(filter(ctx, "bandpass", 1800)).connect(envelope(ctx, at, 0.36, 0.05, 0.12, 0.16)).connect(out);
    // Online: a rising fifth over a soft open chord.
    bell(ctx, out, at + 0.34, 84, 0.2, 0.8);
    bell(ctx, out, at + 0.46, 91, 0.2, 0.9);
    for (const m of [60, 67]) osc(ctx, "triangle", note(m), at + 0.34, at + 1.2).connect(envelope(ctx, at + 0.34, 0.86, 0.07, 0.03, 0.5)).connect(out);
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
  /** A room inspection's diagnostic card: a rising hiss as the scanner sweeps, then two readout chirps. */
  scan: (ctx, out, at, hiss) => {
    const band = filter(ctx, "bandpass", 700);
    band.frequency.setValueAtTime(700, at);
    band.frequency.exponentialRampToValueAtTime(3200, at + 0.3);
    noise(ctx, at, at + 0.36, hiss).connect(band).connect(envelope(ctx, at, 0.36, 0.16, 0.05, 0.12)).connect(out);
    // The scanner's answer: 1244 Hz and its fifth, fixed pitches rather than scale notes.
    for (const [t, hz] of [[0.3, 1244], [0.42, 1865]] as const) {
      osc(ctx, "square", hz, at + t, at + t + 0.1).connect(hit(ctx, at + t, 0.11, 0.08)).connect(out);
    }
  },
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

/** A short burst of hiss through a band of `hz`, for knocks, clacks and steam. */
function burst(ctx: Ctx, out: AudioNode, at: number, hiss: AudioBuffer, hz: number, length: number, gain: AudioNode): void {
  const band = filter(ctx, "bandpass", hz);
  noise(ctx, at, at + length, hiss).connect(band).connect(gain).connect(out);
}

/**
 * A few speech-like syllables in one clearer voice than the murmur: a sawtooth per syllable through a bandpass
 * "vowel", a tiny consonant at each start, all softened through a lowpass. The second syllable rises a little, so a
 * two-syllable bark reads as a friendly "hello?".
 */
function syllables(ctx: Ctx, out: AudioNode, at: number, hiss: AudioBuffer, parts: readonly (readonly [number, number, number, number])[], cutoff: number): void {
  const room = filter(ctx, "lowpass", cutoff);
  room.connect(out);
  parts.forEach(([delay, hz, formant, length], i) => {
    const t = at + delay;
    const vowel = filter(ctx, "bandpass", formant);
    vowel.Q.value = 1.6;
    const o = osc(ctx, "sawtooth", hz, t, t + length);
    if (i === 1) {
      o.frequency.setValueAtTime(hz, t);
      o.frequency.linearRampToValueAtTime(hz * 1.08, t + length);
    }
    o.connect(envelope(ctx, t, length, 0.18, 0.03, 0.07)).connect(vowel).connect(room);
    burst(ctx, room, t, hiss, formant * 1.8, Math.min(0.045, length), hit(ctx, t, 0.18 * 0.35, 0.035));
  });
}

/**
 * The sounds of the office's zones, heard clearly up close near where they are heard (see scene/zoneSounds.ts). They are
 * not game events, so they have no place among the cues above and never compete with them.
 */
const ZONE_VOICES = {
  /** A foosball shot: the rod's clack, then the ball off the side wall. */
  foosball: (ctx, out, at, hiss) => {
    burst(ctx, out, at, hiss, 2100, 0.05, hit(ctx, at, 0.5, 0.045));
    burst(ctx, out, at + 0.11, hiss, 1400, 0.05, hit(ctx, at + 0.11, 0.28, 0.05));
  },
  /** Three quick chiptune notes from an arcade cabinet. */
  arcade: (ctx, out, at) => run(ctx, out, at, [76, 83, 88], 0.07, 0.24, 0.06, 2600),
  /** The espresso machine: a hiss of steam over a low gurgle. */
  espresso: (ctx, out, at, hiss) => {
    burst(ctx, out, at, hiss, 3600, 1.4, envelope(ctx, at, 1.4, 0.16, 0.15, 0.6));
    const low = filter(ctx, "lowpass", 380);
    noise(ctx, at + 0.2, at + 1.2, hiss).connect(low).connect(envelope(ctx, at + 0.2, 1.0, 0.3, 0.1, 0.4)).connect(out);
  },
  /** A sleeper breathing out, slow and soft. */
  snore: (ctx, out, at, hiss) => {
    const low = filter(ctx, "lowpass", 520);
    noise(ctx, at, at + 1.6, hiss).connect(low).connect(envelope(ctx, at, 1.6, 0.14, 0.7, 0.8)).connect(out);
    osc(ctx, "sine", 92, at + 0.3, at + 1.3).connect(envelope(ctx, at + 0.3, 1.0, 0.05, 0.4, 0.5)).connect(out);
  },
  /** Table tennis: the hollow knock of a paddle, then the ball's quieter bounce on the table. */
  pingPong: (ctx, out, at, hiss) => {
    osc(ctx, "sine", 420, at, at + 0.07).connect(hit(ctx, at, 0.32, 0.05)).connect(out);
    burst(ctx, out, at, hiss, 1600, 0.03, hit(ctx, at, 0.2, 0.025));
    osc(ctx, "sine", 640, at + 0.1, at + 0.14).connect(hit(ctx, at + 0.1, 0.14, 0.03)).connect(out);
  },
  /** Nearby voices: short, alternating speech-like syllables softened into an indistinct murmur, never words. */
  murmur: (ctx, out, at, hiss) => {
    const room = filter(ctx, "lowpass", 1450);
    room.connect(out);
    for (const [delay, fundamental, formant, length, peak] of [
      [0, 145, 620, 0.2, 0.13],
      [0.2, 165, 860, 0.17, 0.1],
      [0.43, 132, 700, 0.23, 0.14],
      [0.7, 152, 940, 0.18, 0.1],
    ] as const) {
      const t = at + delay;
      const vowel = filter(ctx, "bandpass", formant);
      vowel.Q.value = 1.6;
      osc(ctx, "sawtooth", fundamental, t, t + length)
        .connect(envelope(ctx, t, length, peak, 0.035, 0.08))
        .connect(vowel)
        .connect(room);
      burst(ctx, room, t, hiss, formant * 1.8, Math.min(0.045, length), hit(ctx, t, peak * 0.35, 0.035));
    }
  },
  /** Typing at a desk: a few tiny high clicks at an uneven pace. */
  keyboard: (ctx, out, at, hiss) => {
    for (const t of [0, 0.07, 0.19, 0.26, 0.38, 0.47]) {
      burst(ctx, out, at + t, hiss, 5200, 0.015, hit(ctx, at + t, 0.16, 0.012));
    }
  },
  /** Someone in the phone booth: two short, muffled syllables, not a ring. */
  phone: (ctx, out, at) => {
    const bp = filter(ctx, "bandpass", 1100);
    bp.Q.value = 1.4;
    bp.connect(out);
    [
      [0, 57, 0.14],
      [0.2, 60, 0.12],
    ].forEach(([t, m, len]) => {
      const o = osc(ctx, "sawtooth", note(m), at + t, at + t + len);
      o.frequency.setValueAtTime(note(m), at + t);
      o.frequency.linearRampToValueAtTime(note(m + 1), at + t + len);
      o.connect(envelope(ctx, at + t, len, 0.16, 0.02, 0.05)).connect(bp);
    });
  },
  /** A talk in the meeting room: one low phrase that moves through three pitches. */
  presentation: (ctx, out, at) => {
    const lp = filter(ctx, "lowpass", 750);
    lp.connect(out);
    [
      [0, 50, 0.22],
      [0.22, 55, 0.2],
      [0.42, 52, 0.26],
    ].forEach(([t, m, len]) => {
      osc(ctx, "triangle", note(m), at + t, at + t + len).connect(envelope(ctx, at + t, len, 0.16, 0.04, 0.08)).connect(lp);
    });
  },
  /** The kitchen counter: two light clinks of crockery. */
  kitchen: (ctx, out, at, hiss) => {
    burst(ctx, out, at, hiss, 4300, 0.04, hit(ctx, at, 0.24, 0.035));
    osc(ctx, "sine", 2400, at, at + 0.09).connect(hit(ctx, at, 0.08, 0.08)).connect(out);
    burst(ctx, out, at + 0.13, hiss, 3600, 0.04, hit(ctx, at + 0.13, 0.18, 0.03));
    osc(ctx, "sine", 1900, at + 0.13, at + 0.2).connect(hit(ctx, at + 0.13, 0.06, 0.06)).connect(out);
  },
  /** The television murmuring in the corner: a low wash of noise and two quiet blips. */
  television: (ctx, out, at, hiss) => {
    const lp = filter(ctx, "lowpass", 800);
    noise(ctx, at, at + 0.5, hiss).connect(lp).connect(envelope(ctx, at, 0.5, 0.15, 0.08, 0.2)).connect(out);
    osc(ctx, "sine", note(69), at + 0.1, at + 0.16).connect(hit(ctx, at + 0.1, 0.09, 0.05)).connect(out);
    osc(ctx, "sine", note(74), at + 0.28, at + 0.34).connect(hit(ctx, at + 0.28, 0.09, 0.05)).connect(out);
  },
} satisfies Record<string, Voice>;

export type ZoneCue = keyof typeof ZONE_VOICES;
export const ZONE_CUES = Object.keys(ZONE_VOICES) as ZoneCue[];

/** The car's hum as it rides: a low tone sliding up or down under a soft rush of air, for about the length of a ride. */
function hum(ctx: Ctx, out: AudioNode, at: number, hiss: AudioBuffer, rising: boolean): void {
  const length = 1.25;
  // The motor's whir and its octave, in the range a laptop's speakers play, sliding with the car's speed.
  const [from, to] = rising ? [170, 250] : [250, 170];
  for (const [octave, peak] of [
    [1, 0.08],
    [2, 0.03],
  ] as const) {
    const o = osc(ctx, "triangle", from * octave, at, at + length);
    o.frequency.setValueAtTime(from * octave, at);
    o.frequency.linearRampToValueAtTime(to * octave, at + length);
    o.connect(envelope(ctx, at, length, peak, 0.2, 0.35)).connect(out);
  }
  // Air rushing past the car, its pitch sweeping the way it travels.
  const [low, high] = rising ? [500, 1400] : [1400, 500];
  const air = filter(ctx, "bandpass", low);
  air.frequency.setValueAtTime(low, at);
  air.frequency.exponentialRampToValueAtTime(high, at + length);
  noise(ctx, at, at + length, hiss).connect(air).connect(envelope(ctx, at, length, 0.2, 0.3, 0.45)).connect(out);
  // The low rumble of the shaft, for speakers that can play it.
  const rumble = osc(ctx, "sawtooth", rising ? 62 : 98, at, at + length);
  rumble.frequency.linearRampToValueAtTime(rising ? 98 : 62, at + length);
  rumble.connect(filter(ctx, "lowpass", 240)).connect(envelope(ctx, at, length, 0.06, 0.25, 0.35)).connect(out);
}

/**
 * The elevator: the call button's click, the car's hum, the chime as it arrives (higher going up than going down),
 * and the doors sliding and meeting. They answer the player switching floors.
 */
const LIFT_VOICES = {
  call: (ctx, out, at, hiss) => burst(ctx, out, at, hiss, 2800, 0.03, hit(ctx, at, 0.3, 0.03)),
  humUp: (ctx, out, at, hiss) => hum(ctx, out, at, hiss, true),
  humDown: (ctx, out, at, hiss) => hum(ctx, out, at, hiss, false),
  chimeUp: (ctx, out, at) => {
    bell(ctx, out, at, 79, 0.15, 1.0);
    bell(ctx, out, at + 0.24, 84, 0.15, 1.3);
  },
  chimeDown: (ctx, out, at) => {
    bell(ctx, out, at, 76, 0.15, 1.0);
    bell(ctx, out, at + 0.24, 72, 0.15, 1.3);
  },
  /** One short bell for a ride cut straight to its floor, on the chime's last note. */
  dingUp: (ctx, out, at) => bell(ctx, out, at, 84, 0.12, 0.6),
  dingDown: (ctx, out, at) => bell(ctx, out, at, 72, 0.12, 0.6),
  /** The indicator ticking over as the car passes between the floors. */
  tick: (ctx, out, at, hiss) => {
    osc(ctx, "square", 1760, at, at + 0.04).connect(filter(ctx, "lowpass", 3200)).connect(hit(ctx, at, 0.07, 0.035)).connect(out);
    burst(ctx, out, at, hiss, 3800, 0.02, hit(ctx, at, 0.12, 0.02));
  },
  doors: (ctx, out, at, hiss) => burst(ctx, out, at, hiss, 900, 0.45, envelope(ctx, at, 0.45, 0.3, 0.12, 0.25)),
  thud: (ctx, out, at, hiss) => {
    osc(ctx, "triangle", 68, at, at + 0.2).connect(hit(ctx, at, 0.22, 0.16)).connect(out);
    burst(ctx, out, at, hiss, 300, 0.08, hit(ctx, at, 0.12, 0.07));
  },
} satisfies Record<string, Voice>;

export type LiftCue = keyof typeof LIFT_VOICES;
export const LIFT_CUES = Object.keys(LIFT_VOICES) as LiftCue[];

/**
 * Sounds of walking the building: footsteps on carpet, on tile or concrete and on the server hall's raised floor;
 * the hiss of a glass door sliding; the pop of a new avatar arriving; and the crew's own voices, a short bark each
 * in the register of its body plan, standing in for a hello or a word overheard where the browser cannot speak
 * the line (see game/speech.ts and scene/greetings.ts).
 */
const SCENE_VOICES = {
  stepSoft: (ctx, out, at, hiss) => burst(ctx, out, at, hiss, 320, 0.07, hit(ctx, at, 0.22, 0.06)),
  stepHard: (ctx, out, at, hiss) => {
    burst(ctx, out, at, hiss, 1900, 0.03, hit(ctx, at, 0.18, 0.025));
    burst(ctx, out, at, hiss, 380, 0.05, hit(ctx, at, 0.14, 0.045));
  },
  stepHollow: (ctx, out, at, hiss) => {
    osc(ctx, "triangle", 150, at, at + 0.12).connect(hit(ctx, at, 0.2, 0.09)).connect(out);
    burst(ctx, out, at, hiss, 650, 0.05, hit(ctx, at, 0.12, 0.05));
  },
  hiss: (ctx, out, at, hiss) => burst(ctx, out, at, hiss, 2600, 0.38, envelope(ctx, at, 0.38, 0.14, 0.03, 0.3)),
  /** The view changing: air swept up and back down through a band, soft and quick. */
  whoosh: (ctx, out, at, hiss) => {
    const band = filter(ctx, "bandpass", 300);
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(300, at);
    band.frequency.exponentialRampToValueAtTime(1500, at + 0.24);
    band.frequency.exponentialRampToValueAtTime(400, at + 0.5);
    noise(ctx, at, at + 0.5, hiss).connect(band).connect(envelope(ctx, at, 0.5, 0.22, 0.2, 0.26)).connect(out);
  },
  pop: (ctx, out, at) => {
    const o = osc(ctx, "sine", 880, at, at + 0.16);
    o.frequency.setValueAtTime(880, at);
    o.frequency.exponentialRampToValueAtTime(420, at + 0.12);
    o.connect(hit(ctx, at, 0.3, 0.14)).connect(out);
    osc(ctx, "triangle", 1320, at + 0.05, at + 0.14).connect(hit(ctx, at + 0.05, 0.08, 0.08)).connect(out);
  },
  /** The small round species: a quick, high two-syllable chirp. */
  voiceBlob: (ctx, out, at, hiss) =>
    syllables(ctx, out, at, hiss, [
      [0, 235, 950, 0.11],
      [0.14, 270, 1250, 0.13],
    ] as const, 2600),
  /** The big two-legged species: a low, slow two-syllable rumble. */
  voiceBig: (ctx, out, at, hiss) =>
    syllables(ctx, out, at, hiss, [
      [0, 105, 520, 0.18],
      [0.23, 92, 700, 0.2],
    ] as const, 1300),
  /** The hovering flyer: a buzz that wobbles, not syllables. */
  voiceFlyer: (ctx, out, at) => {
    const bp = filter(ctx, "bandpass", 1400);
    bp.Q.value = 1.2;
    const o = osc(ctx, "sawtooth", 180, at, at + 0.3);
    const wobble = osc(ctx, "sine", 28, at, at + 0.3);
    const depth = ctx.createGain();
    depth.gain.value = 40;
    wobble.connect(depth).connect(o.detune);
    o.connect(bp).connect(envelope(ctx, at, 0.3, 0.16, 0.04, 0.1)).connect(out);
  },
} satisfies Record<string, Voice>;

export type SceneCue = keyof typeof SCENE_VOICES;
export const SCENE_CUES = Object.keys(SCENE_VOICES) as SceneCue[];

/** When the elevator's doors move after the car arrives, in seconds: they open at once, start closing at `close` and meet at `shut`. */
export interface LiftDoors {
  close: number;
  shut: number;
}

/** Shortest gap between two plays of the same zone sound, in milliseconds. */
const ZONE_GAP: Record<ZoneCue, number> = {
  foosball: 250,
  pingPong: 300,
  arcade: 1200,
  espresso: 6000,
  kitchen: 2500,
  television: 1800,
  keyboard: 700,
  phone: 2200,
  presentation: 2500,
  murmur: 1800,
  snore: 3000,
};

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
  launch: 3000,
  unlock: 600,
  weekUp: 300,
  weekDown: 300,
  success: 150,
  failure: 150,
  promo: 300,
  hire: 200,
  clunk: 150,
  confirm: 100,
  scan: 120,
  buzz: 200,
  blip: 70,
  preview: 120,
};

/** Bus gain at full volume. The default 80% gives about 0.58. */
const PEAK = 0.9;
/**
 * A cue that cannot start this soon after it was asked for is dropped, so a
 * late wake-up never plays a pile of old sounds. Waking can take over a second
 * on a busy page.
 */
const FRESH_MS = 1000;
/** Silence this long before the audio sleeps: a mute flipped straight back needs no wake-up. */
const SLEEP_MS = 10_000;
/** Seconds to follow a volume slider. */
const SLIDE = 0.05;

export interface Sfx {
  /**
   * The elevator sets off, up or down: the call button's click, the car's whir and rush of air, and the indicator's
   * tick `tickIn` seconds later as it passes between the floors. Doors still to close from the last ride fall silent.
   */
  liftDepart(up: boolean, tickIn: number): void;
  /** The car arrives: its hum stops, the chime sounds and the doors open, wait and close. */
  liftArrive(up: boolean, doors: LiftDoors): void;
  /** The view cut straight to a floor, up or down, with no ride shown: one short bell, and the last ride falls silent. */
  liftCut(up: boolean): void;
  /**
   * Play a sound of walking the building at `level` (0 to 1) of the effects volume. With `wake`, as for a press of
   * the player's own, it may start the audio; otherwise, like the zones' sounds, it plays only while the audio runs.
   */
  playScene(cue: SceneCue, level: number, wake?: boolean): void;
  /**
   * Play a zone's sound at `level` (0 to 1) of the effects volume, unless the sound is off, the audio is asleep or
   * the same sound has only just played. Zone sounds never wake the audio: they are only scenery.
   */
  playZone(cue: ZoneCue, level: number): void;
  /** Play a cue now, unless the sound is off or the same cue has only just played. */
  play(cue: Cue): void;
  /** The player's effects volume, 0 to 100; 0 when muted. At 0 the audio is suspended. */
  setVolume(percent: number): void;
  /** Stop for good and release the audio device. */
  dispose(): void;
}

const SILENT: Sfx = { play() {}, playZone() {}, liftDepart() {}, liftArrive() {}, liftCut() {}, playScene() {}, setVolume() {}, dispose() {} };

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

  const lastZone = new Map<ZoneCue, number>();

  /** Run `voices` on the audio now, waking it if it wakes promptly, as a cue would. */
  function whenAwake(voices: (c: AudioContext) => void): void {
    if (disposed || percent <= 0) return;
    const t = now();
    const c = start();
    const run = () => {
      try {
        voices(c);
      } catch (error) {
        if (!warned) console.warn("A sound effect could not be played; the game carries on without it.", error);
        warned = true;
      }
    };
    if (c.state === "running") {
      run();
      return;
    }
    c.resume()
      .then(() => {
        if (ctx === c && !disposed && percent > 0 && now() - t < FRESH_MS) run();
      })
      .catch(() => {});
  }

  /** Each ride's sounds go through a gain of their own, so the next ride can silence what is left of them; the hum has one inside it. */
  let ride: GainNode | null = null;
  let humming: GainNode | null = null;
  const fade = (g: GainNode, c: BaseAudioContext, seconds: number) => {
    const at = c.currentTime;
    g.gain.cancelScheduledValues(at);
    g.gain.setValueAtTime(g.gain.value, at);
    g.gain.linearRampToValueAtTime(0, at + seconds);
  };
  const lane = (c: AudioContext, into: AudioNode) => {
    const g = c.createGain();
    g.gain.value = 1;
    g.connect(into);
    return g;
  };

  return {
    liftDepart(up, tickIn) {
      whenAwake((c) => {
        if (!bus || !hiss) return;
        if (ride) fade(ride, c, 0.08);
        ride = lane(c, bus);
        humming = lane(c, ride);
        const at = c.currentTime + 0.005;
        LIFT_VOICES.call(c, ride, at, hiss);
        LIFT_VOICES[up ? "humUp" : "humDown"](c, humming, at + 0.05, hiss);
        // On the hum's lane, so arriving early silences a tick still to come.
        LIFT_VOICES.tick(c, humming, at + tickIn, hiss);
      });
    },
    playScene(cue, level, wake = false) {
      if (level <= 0) return;
      const voice = (c: AudioContext) => {
        if (!bus || !hiss) return;
        const g = lane(c, bus);
        g.gain.value = Math.min(1, level);
        SCENE_VOICES[cue](c, g, c.currentTime + 0.005, hiss);
      };
      if (wake) whenAwake(voice);
      else if (!disposed && percent > 0 && ctx && ctx.state === "running") voice(ctx);
    },
    liftArrive(up, doors) {
      whenAwake((c) => {
        if (!bus || !hiss) return;
        if (humming) fade(humming, c, 0.15);
        ride ??= lane(c, bus);
        const at = c.currentTime + 0.005;
        LIFT_VOICES[up ? "chimeUp" : "chimeDown"](c, ride, at);
        LIFT_VOICES.doors(c, ride, at + 0.05, hiss);
        LIFT_VOICES.doors(c, ride, at + doors.close, hiss);
        LIFT_VOICES.thud(c, ride, at + doors.shut, hiss);
      });
    },
    liftCut(up) {
      whenAwake((c) => {
        if (!bus) return;
        if (ride) fade(ride, c, 0.08);
        ride = lane(c, bus);
        humming = null;
        LIFT_VOICES[up ? "dingUp" : "dingDown"](c, ride, c.currentTime + 0.005);
      });
    },
    playZone(cue, level) {
      if (disposed || percent <= 0 || level <= 0 || !ctx || !bus || !hiss || ctx.state !== "running") return;
      const t = now();
      if (t - (lastZone.get(cue) ?? -Infinity) < ZONE_GAP[cue]) return;
      lastZone.set(cue, t);
      try {
        const g = ctx.createGain();
        g.gain.value = Math.min(1, level);
        g.connect(bus);
        ZONE_VOICES[cue](ctx, g, ctx.currentTime + 0.005, hiss);
      } catch (error) {
        if (!warned) console.warn("A sound effect could not be played; the game carries on without it.", error);
        warned = true;
      }
    },
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
      } else sleep = window.setTimeout(() => c.suspend().catch(() => {}), SLEEP_MS);
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
export async function renderCue(cue: Cue | ZoneCue | LiftCue | SceneCue, rate = 44100): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.round(rate * 2), rate);
  const voice: Voice =
    cue in ZONE_VOICES ? ZONE_VOICES[cue as ZoneCue] : cue in LIFT_VOICES ? LIFT_VOICES[cue as LiftCue] : cue in SCENE_VOICES ? SCENE_VOICES[cue as SceneCue] : VOICES[cue as Cue];
  voice(ctx, ctx.destination, 0.01, hissBuffer(ctx));
  return ctx.startRendering();
}
