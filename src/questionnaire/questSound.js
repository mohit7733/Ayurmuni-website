// Synthesized quest sound effects (Web Audio API, no audio files).
// The AudioContext is created lazily on the first call, which always happens
// inside a click handler, so browsers only play sound after a user gesture.
const MUTE_KEY = 'ayurmuni__QUEST_MUTED';
let ctx = null;

export const isQuestMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setQuestMuted = (muted) => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
};

const audio = () => {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

const tone = (ac, { freq, start = 0, dur = 0.18, type = 'sine', gain = 0.12, to }) => {
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
};

const whooshNoise = (ac) => {
  const dur = 0.28;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  const t = ac.currentTime;
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(2400, t + dur);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(0.07, t + 0.08);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(t);
};

const SOUNDS = {
  tap: (ac) => {
    tone(ac, { freq: 880, dur: 0.16, gain: 0.09 });
    tone(ac, { freq: 1320, start: 0.04, dur: 0.18, gain: 0.05 });
  },
  next: (ac) => whooshNoise(ac),
  levelUp: (ac) =>
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone(ac, { freq, start: i * 0.09, dur: 0.22, type: 'triangle', gain: 0.1 }),
    ),
  fanfare: (ac) => {
    [523.25, 659.25, 783.99].forEach((freq, i) =>
      tone(ac, { freq, start: i * 0.12, dur: 0.2, type: 'triangle', gain: 0.11 }),
    );
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) =>
      tone(ac, { freq, start: 0.4, dur: 0.7, type: 'triangle', gain: 0.07 }),
    );
  },
};

export const playQuestSound = (name) => {
  if (isQuestMuted()) return;
  try {
    const ac = audio();
    if (ac && SOUNDS[name]) SOUNDS[name](ac);
  } catch {
    /* audio is optional */
  }
};

export const questHaptic = (pattern = 12) => {
  try {
    if (!isQuestMuted() && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* haptics are optional */
  }
};
