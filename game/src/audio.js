// All sound is synthesized with WebAudio — no audio files, no network.
// The context is created on the first user gesture (browsers block audio
// before one). Every effect is a short oscillator/noise burst; `muted` silences
// them all. In a non-browser context (headless logic tests) every call is a no-op.

let context = null;
let muted = false;
let master = null;

function ensureContext() {
  if (typeof window === 'undefined' || context) return context;
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return null;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
  return context;
}

export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = value ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type, volume, when = 0, slideTo = null) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !master) return;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** A soft footstep tick; quieter the further the guard is from the player. */
export function playFootstep(distance) {
  if (muted) return;
  const volume = Math.max(0.02, 0.16 * (1 - distance / 420));
  tone(140 + Math.random() * 40, 0.06, 'triangle', volume);
}

/** Two-note chime when a relic is pocketed. */
export function playPickup() {
  tone(660, 0.12, 'sine', 0.22);
  tone(990, 0.18, 'sine', 0.2, 0.09);
}

/** The alarm: two harsh sawtooth blasts. */
export function playAlarm() {
  tone(220, 0.22, 'sawtooth', 0.2, 0, 440);
  tone(220, 0.22, 'sawtooth', 0.2, 0.26, 440);
}

/** A low sting when a warden catches the player. */
export function playCaught() {
  tone(160, 0.5, 'sawtooth', 0.25, 0, 55);
  tone(110, 0.6, 'square', 0.14, 0.1, 40);
}

/** A rising arpeggio for clearing a level, longer for the final getaway. */
export function playWin(final = false) {
  const notes = final ? [523, 659, 784, 1047] : [523, 659, 784];
  notes.forEach((freq, i) => tone(freq, 0.22, 'sine', 0.2, i * 0.11));
}

/** A soft click for menus and the exit door opening. */
export function playClick() {
  tone(880, 0.07, 'sine', 0.14);
}
