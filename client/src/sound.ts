// Tiny synthesized sound effects (Web Audio) - no audio files needed.
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function knock(start: number, pitch: number, gain: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const len = Math.floor(a.sampleRate * 0.06);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = pitch;
  f.Q.value = 1.2;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  move: () => knock(0, 1400, 0.9),
  capture: () => {
    knock(0, 900, 1.1);
    knock(0.04, 600, 0.7);
  },
  check: () => {
    tone(880, 0, 0.09, 'triangle', 0.08);
    tone(1175, 0.07, 0.12, 'triangle', 0.08);
  },
  blunder: () => {
    tone(330, 0, 0.18, 'sawtooth', 0.05);
    tone(247, 0.15, 0.3, 'sawtooth', 0.05);
  },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.35, 'triangle', 0.09)),
  fail: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.12, 0.3, 'sine', 0.08)),
  clove: () => {
    tone(660, 0, 0.12, 'sine', 0.1);
    tone(990, 0.08, 0.25, 'sine', 0.08);
  },
  cloveSmall: () => tone(740, 0, 0.14, 'sine', 0.07),
  bulb: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.07, 0.5, 'triangle', 0.07)),
  tick: () => tone(1500, 0, 0.03, 'square', 0.02),
  golden: () => [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, i * 0.06, 0.4, 'sine', 0.05)),
  shield: () => [392, 523, 784].forEach((f, i) => tone(f, i * 0.09, 0.45, 'triangle', 0.08)),
};
