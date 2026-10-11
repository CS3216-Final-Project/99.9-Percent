/*
 * Just enough of the Web Audio API to run the music and effects players in
 * jsdom: nodes connect and schedule but make no sound. Parameters remember the
 * last value they were set or ramped to, and contexts count what they build.
 */

class FakeParam {
  value = 0;
  /** Every value a ramp has headed for, in order. */
  ramps: number[] = [];
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.ramps.push(v);
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.ramps.push(v);
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  connect<T>(next: T): T {
    return next;
  }
  disconnect() {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeScheduled extends FakeNode {
  started = 0;
  start() {
    this.started++;
  }
  stop() {}
}

class FakeOscillator extends FakeScheduled {
  type = "sine";
  frequency = new FakeParam();
  detune = new FakeParam();
}

class FakeSource extends FakeScheduled {
  buffer: FakeBuffer | null = null;
  loop = false;
}

class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam();
  Q = new FakeParam();
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}

class FakeBuffer {
  readonly length: number;
  readonly sampleRate: number;
  private data: Float32Array;
  constructor(_channels: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = new Float32Array(length);
  }
  getChannelData() {
    return this.data;
  }
}

export class FakeAudioContext {
  /** Every realtime context made since the last reset. */
  static made: FakeAudioContext[] = [];
  /** What `resume()` does; tests can make it hang or fail. */
  static resume: (ctx: FakeAudioContext) => Promise<void> = (ctx) => {
    ctx.state = "running";
    return Promise.resolve();
  };
  static reset() {
    FakeAudioContext.made = [];
    FakeAudioContext.resume = (ctx) => {
      ctx.state = "running";
      return Promise.resolve();
    };
  }

  state: "running" | "suspended" | "closed" = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  sources: FakeSource[] = [];

  constructor() {
    FakeAudioContext.made.push(this);
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  createDynamicsCompressor() {
    return new FakeCompressor();
  }
  createBuffer(channels: number, length: number, rate: number) {
    return new FakeBuffer(channels, length, rate);
  }
  resume() {
    return FakeAudioContext.resume(this);
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
  /** Sounds started on this context: oscillators and buffer sources. */
  get voices() {
    return this.oscillators.length + this.sources.length;
  }
}

export class FakeOfflineAudioContext extends FakeAudioContext {
  readonly length: number;
  constructor(_channels: number, length: number, rate: number) {
    super();
    // Only realtime contexts count as made.
    FakeAudioContext.made.pop();
    this.length = length;
    this.sampleRate = rate;
  }
  startRendering() {
    return Promise.resolve(new FakeBuffer(1, this.length, this.sampleRate));
  }
}
