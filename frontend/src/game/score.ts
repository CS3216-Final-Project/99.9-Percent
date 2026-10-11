/*
 * The game's background music, written out as notes. Two loops: a mellow
 * lo-fi groove for running the company, and a fast, minor-key pulse with an
 * alarm motif for incidents. Kept free of the Web Audio API so the music can be
 * checked in tests; music.ts turns a score into sound.
 */

export type Mood = "calm" | "tense";
export const MOODS: Mood[] = ["calm", "tense"];

export type Voice = "pad" | "pluck" | "bass" | "kick" | "snare" | "hat" | "alarm";
/** Voices with a pitch; the rest are drums. */
export const PITCHED: Voice[] = ["pad", "pluck", "bass", "alarm"];

export interface Note {
  /** When the note starts and how long it lasts, in beats from the start of the loop. */
  beat: number;
  beats: number;
  /** MIDI note number; ignored for drums. */
  midi: number;
  voice: Voice;
  /** Loudness from 0 to 1 before mixing. */
  gain: number;
}

export interface Score {
  mood: Mood;
  bpm: number;
  /** Length of the loop in beats. */
  beats: number;
  notes: Note[];
}

/** Four beats to a bar; each chord lasts two bars. */
const BAR = 4;
const CHORD = 2 * BAR;

export function secondsOf(score: Score): number {
  return (score.beats * 60) / score.bpm;
}

export function frequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const note = (beat: number, beats: number, midi: number, voice: Voice, gain: number): Note => ({ beat, beats, midi, voice, gain });

/** The groove for building the company: Fmaj7, Em7, Dm7, Cmaj7 at an easy 84 beats a minute. */
function calm(): Score {
  const chords = [
    [53, 57, 60, 64],
    [52, 55, 59, 62],
    [50, 53, 57, 60],
    [48, 52, 55, 59],
  ];
  // Chord tones for the arpeggio, eighth by eighth; -1 is a rest.
  const arpeggio = [0, 2, 1, 3, 2, -1, 1, 2, 3, 2, 1, -1, 0, 1, 2, -1];
  const notes: Note[] = [];
  chords.forEach((chord, c) => {
    const at = c * CHORD;
    for (const midi of chord) notes.push(note(at, CHORD, midi, "pad", 0.5));
    const root = chord[0] - 12;
    for (const [beat, beats] of [
      [0, 1.5],
      [3.5, 0.5],
      [4, 1.5],
      [6, 1.5],
    ])
      notes.push(note(at + beat, beats, root, "bass", 0.8));
    arpeggio.forEach((i, k) => {
      if (i >= 0) notes.push(note(at + k * 0.5, 0.5, chord[i] + 12, "pluck", k % 4 === 0 ? 0.55 : 0.4));
    });
  });
  for (let bar = 0; bar < chords.length * 2; bar++) {
    const at = bar * BAR;
    notes.push(note(at, 0.5, 0, "kick", 0.9), note(at + 2.5, 0.5, 0, "kick", 0.7));
    notes.push(note(at + 1, 0.5, 0, "snare", 0.45), note(at + 3, 0.5, 0, "snare", 0.45));
    // Swung hats: the off-beat eighths land a little late.
    for (let e = 0; e < 8; e++) notes.push(note(at + e * 0.5 + (e % 2 ? 0.08 : 0), 0.25, 0, "hat", e % 2 ? 0.35 : 0.55));
  }
  return { mood: "calm", bpm: 84, beats: chords.length * CHORD, notes };
}

/** The incident: Am, F, Dm, E at 132 beats a minute, a pulsing bass and an alarm that will not stop. */
function tense(): Score {
  const chords = [
    [57, 60, 64],
    [53, 57, 60],
    [50, 53, 57],
    [52, 56, 59],
  ];
  const stabs = [0, 0.75, 1.5, 2.5, 3];
  const notes: Note[] = [];
  chords.forEach((chord, c) => {
    const at = c * CHORD;
    for (const midi of chord) notes.push(note(at, CHORD, midi - 12, "pad", 0.35));
    const root = chord[0] - 12;
    for (let e = 0; e < CHORD * 2; e++) notes.push(note(at + e * 0.5, 0.4, root, "bass", e % 2 ? 0.55 : 0.8));
    for (let bar = 0; bar < 2; bar++) for (const s of stabs) for (const midi of chord) notes.push(note(at + bar * BAR + s, 0.25, midi + 12, "pluck", 0.3));
    // The alarm: a semitone wail in the second bar of every chord.
    notes.push(note(at + BAR, 1, 81, "alarm", 0.5), note(at + BAR + 1, 1, 82, "alarm", 0.5));
  });
  for (let bar = 0; bar < chords.length * 2; bar++) {
    const at = bar * BAR;
    for (let b = 0; b < BAR; b++) notes.push(note(at + b, 0.5, 0, "kick", 0.9));
    notes.push(note(at + 1, 0.5, 0, "snare", 0.55), note(at + 3, 0.5, 0, "snare", 0.55));
    for (let s = 0; s < 16; s++) notes.push(note(at + s * 0.25, 0.2, 0, "hat", s % 2 ? 0.25 : 0.4));
  }
  return { mood: "tense", bpm: 132, beats: chords.length * CHORD, notes };
}

export function compose(mood: Mood): Score {
  return mood === "calm" ? calm() : tense();
}
