import { useSettings } from "../store/settings";

// Original tones, not Microsoft's recordings. Each note is [frequency Hz, start s, length s].
const tone = (wave: OscillatorType, gain: number, notes: [number, number, number][]) => ({ wave, gain, notes });
const TONES = {
  startup: tone("sine", 0.22, [
    [311, 0, 2.2],
    [466, 0.14, 2],
    [622, 0.28, 1.9],
    [784, 0.42, 1.8],
    [932, 0.62, 1.6],
    [1245, 0.9, 1.3],
  ]),
  logon: tone("sine", 0.22, [
    [523, 0, 0.9],
    [659, 0.12, 0.9],
    [784, 0.24, 1.1],
    [1047, 0.36, 1.2],
  ]),
  logoff: tone("sine", 0.22, [
    [1047, 0, 0.7],
    [784, 0.12, 0.8],
    [659, 0.24, 0.9],
    [523, 0.36, 1.2],
  ]),
  shutdown: tone("sine", 0.22, [
    [932, 0, 1],
    [784, 0.2, 1],
    [622, 0.4, 1.1],
    [466, 0.6, 1.3],
    [311, 0.85, 1.8],
  ]),
  error: tone("triangle", 0.3, [
    [392, 0, 0.45],
    [370, 0, 0.45],
    [196, 0.02, 0.5],
  ]),
  exclamation: tone("triangle", 0.3, [
    [880, 0, 0.3],
    [698, 0.1, 0.45],
  ]),
  ding: tone("sine", 0.3, [
    [1319, 0, 0.7],
    [2637, 0, 0.35],
  ]),
  notify: tone("sine", 0.22, [
    [988, 0, 0.25],
    [1319, 0.1, 0.45],
  ]),
  recycle: tone("sawtooth", 0.06, [
    [180, 0, 0.08],
    [140, 0.07, 0.08],
    [220, 0.14, 0.07],
    [120, 0.2, 0.12],
  ]),
  navigate: tone("square", 0.04, [[2200, 0, 0.025]]),
};
export type Sound = keyof typeof TONES;

let ctx: AudioContext | undefined;
const files = new Map<Sound, Promise<AudioBuffer | null>>();

/** Call from a click handler: browsers only start audio after a user gesture. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// A file dropped at public/sounds/<name>.(wav|mp3|ogg) wins; the server answers 204 when there is none.
const load = (name: Sound, ac: AudioContext) =>
  fetch(`sounds/${name}`)
    .then((r) => (r.status === 200 ? r.arrayBuffer().then((b) => ac.decodeAudioData(b)) : null))
    .catch(() => null);

export function play(name: Sound) {
  if (!useSettings.getState().sound || typeof AudioContext === "undefined") return;
  const ac = unlockAudio();
  if (!files.has(name)) files.set(name, load(name, ac));
  void files.get(name)!.then((buffer) => {
    if (buffer) {
      const src = new AudioBufferSourceNode(ac, { buffer });
      src.connect(ac.destination);
      src.start();
      return;
    }
    const { wave, gain, notes } = TONES[name],
      t0 = ac.currentTime + 0.02;
    for (const [freq, at, len] of notes) {
      const osc = new OscillatorNode(ac, { type: wave, frequency: freq }),
        env = new GainNode(ac);
      // Quick attack, exponential tail: reads as a soft bell rather than a beep.
      env.gain.setValueAtTime(0, t0 + at);
      env.gain.linearRampToValueAtTime(gain, t0 + at + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      osc.connect(env).connect(ac.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + len + 0.05);
    }
  });
}
