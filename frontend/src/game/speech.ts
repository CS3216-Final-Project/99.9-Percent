import { loudness } from "./synth";

/*
 * The crew's spoken words through the browser's own speech (the Web Speech API): each line a creature says is
 * read aloud in a voice picked per species, louder the nearer the avatar stands. A fresh line cuts the one
 * before it off, unless it would be heard at less than half the level - then it is dropped, since cutting a
 * louder voice short for a distant murmur sounds worse. Where the browser cannot speak - no speech synthesis,
 * no voices yet, or an engine that has failed - `say` says false and the caller falls back to the synth bark.
 */

/** How a crew member's lines are spoken: pitch and rate as the Web Speech API takes them (1 is the voice's own), and a seed that picks which of the browser's voices it uses. */
export interface Timbre {
  pitch: number;
  rate: number;
  seed: number;
}

/** As much of the browser's speech as the player uses; a fake stands in for tests. */
export interface SpeechApi {
  synth: Pick<SpeechSynthesis, "speak" | "cancel" | "getVoices"> & Partial<Pick<SpeechSynthesis, "addEventListener" | "removeEventListener">>;
  Utterance: new (text: string) => SpeechSynthesisUtterance;
}

export interface Speech {
  /** Say `text` in `timbre`, `near` (0..1, 1 beside the avatar) scaling the effects volume; a new line cuts off the one before it. Returns whether it will be heard: false where the browser cannot speak (no speech, no voice yet, or its engine has failed), muted, or `near` is 0 - a caller may play something else then. */
  say(text: string, timbre: Timbre, near: number): boolean;
  /** Cut off whatever is being said. */
  hush(): void;
  /** The player's effects volume, 0 to 100; 0 when muted, which also hushes. */
  setVolume(percent: number): void;
  dispose(): void;
}

const SILENT: Speech = {
  say: () => false,
  hush() {},
  setVolume() {},
  dispose() {},
};

/** The browser's own speech, or undefined where there is none (tests, a browser without it). */
export function browserSpeech(): SpeechApi | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return undefined;
  return { synth: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance };
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function createSpeech(api: SpeechApi | undefined = browserSpeech()): Speech {
  if (!api) return SILENT;
  const { synth, Utterance } = api;
  let percent = 0;
  let broken = false;
  let disposed = false;
  let voices: SpeechSynthesisVoice[] = [];
  // The utterance being said, with its volume: kept so its end lands and, on Chrome, so it is not collected first.
  let current: { u: SpeechSynthesisUtterance; volume: number } | null = null;

  /**
   * The voices on offer, English where there is any, named so the same seed picks the same one on every visit.
   * Chrome lists none until voiceschanged; an empty answer is not cached, so the next say asks again.
   */
  function list(): SpeechSynthesisVoice[] {
    if (voices.length) return voices;
    let all: SpeechSynthesisVoice[];
    try {
      all = synth.getVoices() ?? [];
    } catch {
      return voices;
    }
    const english = all.filter((v) => /^en/i.test(v.lang));
    voices = [...(english.length ? english : all)].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return voices;
  }
  const refresh = () => {
    voices = [];
  };
  synth.addEventListener?.("voiceschanged", refresh);

  function hush(): void {
    current = null;
    try {
      synth.cancel();
    } catch {
      /* an engine already gone */
    }
  }

  return {
    say(text, timbre, near) {
      if (disposed || broken || percent <= 0 || near <= 0 || !text) return false;
      const available = list();
      if (!available.length) return false;
      const volume = Math.min(1, near * loudness(percent, 1));
      // Not worth cutting a louder voice short: the line is dropped, but counts as heard, so no bark either.
      if (current && volume < current.volume * 0.5) return true;
      const voice = available[mod(timbre.seed, available.length)];
      const u = new Utterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.pitch = timbre.pitch;
      u.rate = timbre.rate;
      u.volume = volume;
      const done = () => {
        if (current?.u === u) current = null;
      };
      u.onend = done;
      u.onerror = (event) => {
        // cancel() interrupts, which is ordinary; anything else means this browser cannot actually speak.
        const kind = (event as SpeechSynthesisErrorEvent).error;
        if (kind !== "interrupted" && kind !== "canceled") broken = true;
        done();
      };
      hush();
      current = { u, volume };
      try {
        synth.speak(u);
      } catch {
        current = null;
        broken = true;
        return false;
      }
      return true;
    },
    hush() {
      if (!disposed) hush();
    },
    setVolume(next) {
      if (disposed) return;
      percent = next;
      if (percent <= 0) hush();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      hush();
      synth.removeEventListener?.("voiceschanged", refresh);
    },
  };
}
