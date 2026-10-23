import { describe, expect, it } from "vitest";
import { createSpeech, type SpeechApi, type Timbre } from "./speech";
import { loudness } from "./synth";

/* A fake Web Speech API: the synth records what it is asked to say, its voices can be swapped and its utterances
 * fire end and error by hand. */

class FakeUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  lang = "";
  pitch = 1;
  rate = 1;
  volume = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const voice = (name: string, lang = "en-US") => ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

function fakeApi(voices: SpeechSynthesisVoice[] = []) {
  const spoken: FakeUtterance[] = [];
  const cancels: number[] = [];
  const listeners = new Map<string, () => void>();
  const api: SpeechApi = {
    synth: {
      getVoices: () => voices,
      speak: (u: SpeechSynthesisUtterance) => spoken.push(u as unknown as FakeUtterance),
      cancel: () => cancels.push(1),
      addEventListener: (name: string, l: () => void) => listeners.set(name, l),
      removeEventListener: (name: string) => listeners.delete(name),
    } as unknown as SpeechApi["synth"],
    Utterance: FakeUtterance as unknown as SpeechApi["Utterance"],
  };
  return {
    api,
    spoken,
    cancels: () => cancels.length,
    setVoices: (next: SpeechSynthesisVoice[]) => {
      voices = next;
    },
    voicesChanged: () => listeners.get("voiceschanged")?.(),
    hasVoicesListener: () => listeners.has("voiceschanged"),
  };
}

const TIMBRE: Timbre = { pitch: 1.4, rate: 1.1, seed: 0 };

describe("the speech player", () => {
  it("is silent and harmless without a speech API", () => {
    const speech = createSpeech(undefined);
    speech.setVolume(80);
    expect(speech.say("Hello", TIMBRE, 1)).toBe(false);
    speech.hush();
    speech.setVolume(0);
    speech.dispose();
  });

  it("speaks the text with the timbre and a volume scaled by nearness, capped at 1", () => {
    const { api, spoken } = fakeApi([voice("Ada")]);
    const speech = createSpeech(api);
    speech.setVolume(80);
    expect(speech.say("Hey boss!", TIMBRE, 0.5)).toBe(true);
    expect(spoken).toHaveLength(1);
    const u = spoken[0];
    expect(u.text).toBe("Hey boss!");
    expect(u.pitch).toBe(1.4);
    expect(u.rate).toBe(1.1);
    expect(u.voice?.lang).toBe("en-US");
    expect(u.lang).toBe("en-US");
    expect(u.volume).toBeCloseTo(0.5 * loudness(80, 1));
    // Right beside it at full volume never exceeds the utterance's own ceiling.
    speech.setVolume(100);
    expect(speech.say("Again", TIMBRE, 1)).toBe(true);
    expect(spoken[1].volume).toBe(1);
  });

  it("picks a voice deterministically by seed, preferring English voices", () => {
    const { api, spoken } = fakeApi([voice("Zoe", "fr-FR"), voice("Ada"), voice("Bert")]);
    const speech = createSpeech(api);
    speech.setVolume(80);
    speech.say("one", TIMBRE, 1);
    speech.say("two", TIMBRE, 1);
    // English voices win and are named, so Ada and Bert are the only picks.
    expect(spoken[0].voice?.name).toBe(spoken[1].voice?.name);
    speech.say("three", { ...TIMBRE, seed: 1 }, 1);
    expect(spoken[2].voice?.name).not.toBe(spoken[0].voice?.name);
    for (const u of spoken) expect(u.voice?.lang).toBe("en-US");
  });

  it("says nothing at volume 0, cancelling what was speaking, and speaks again when it is raised", () => {
    const { api, spoken, cancels } = fakeApi([voice("Ada")]);
    const speech = createSpeech(api);
    speech.setVolume(80);
    speech.say("one", TIMBRE, 1);
    speech.setVolume(0);
    expect(cancels()).toBeGreaterThan(0);
    expect(speech.say("two", TIMBRE, 1)).toBe(false);
    expect(spoken).toHaveLength(1);
    speech.setVolume(80);
    expect(speech.say("three", TIMBRE, 1)).toBe(true);
    expect(spoken).toHaveLength(2);
  });

  it("cuts the line before a new one short, but a much quieter line waits its turn", () => {
    const { api, spoken, cancels } = fakeApi([voice("Ada")]);
    const speech = createSpeech(api);
    speech.setVolume(100);
    speech.say("loud", TIMBRE, 1);
    // Still speaking: a line at under half its volume is dropped, heard or not, so nothing else plays either.
    expect(speech.say("whisper", TIMBRE, 0.4)).toBe(true);
    expect(spoken).toHaveLength(1);
    // A louder line does cut in.
    const before = cancels();
    expect(speech.say("louder", TIMBRE, 1)).toBe(true);
    expect(cancels()).toBe(before + 1);
    expect(spoken).toHaveLength(2);
    // Once the line ends, a quiet one is free to speak.
    spoken[1].onend?.();
    expect(speech.say("quiet", TIMBRE, 0.4)).toBe(true);
    expect(spoken).toHaveLength(3);
  });

  it("says false with no voices until voiceschanged brings them", () => {
    const { api, spoken, setVoices, voicesChanged } = fakeApi();
    const speech = createSpeech(api);
    speech.setVolume(80);
    expect(speech.say("Hello", TIMBRE, 1)).toBe(false);
    expect(spoken).toHaveLength(0);
    setVoices([voice("Ada")]);
    voicesChanged();
    expect(speech.say("Hello", TIMBRE, 1)).toBe(true);
    expect(spoken).toHaveLength(1);
  });

  it("gives up for the session on an engine failure, but not on an interruption", () => {
    const { api, spoken } = fakeApi([voice("Ada")]);
    const speech = createSpeech(api);
    speech.setVolume(80);
    speech.say("one", TIMBRE, 1);
    spoken[0].onerror?.({ error: "synthesis-failed" });
    expect(speech.say("two", TIMBRE, 1)).toBe(false);
    expect(spoken).toHaveLength(1);
    // A cancelled line's "interrupted" is ordinary and breaks nothing.
    const second = fakeApi([voice("Ada")]);
    const again = createSpeech(second.api);
    again.setVolume(80);
    again.say("one", TIMBRE, 1);
    second.spoken[0].onerror?.({ error: "interrupted" });
    expect(again.say("two", TIMBRE, 1)).toBe(true);
  });

  it("is silent after dispose, having cancelled and stopped listening for voices", () => {
    const fake = fakeApi([voice("Ada")]);
    const speech = createSpeech(fake.api);
    speech.setVolume(80);
    speech.say("one", TIMBRE, 1);
    expect(fake.hasVoicesListener()).toBe(true);
    speech.dispose();
    expect(fake.cancels()).toBeGreaterThan(0);
    expect(fake.hasVoicesListener()).toBe(false);
    expect(speech.say("two", TIMBRE, 1)).toBe(false);
    speech.hush();
    speech.setVolume(50);
    expect(fake.spoken).toHaveLength(1);
  });
});
