const SOUND_KEY = 'sendjet_message_sound_enabled';
let audioContext = null;

export const isMessageSoundEnabled = () => localStorage.getItem(SOUND_KEY) !== 'false';

export const setMessageSoundEnabled = (enabled) => {
  localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
};

const getContext = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) audioContext = new AudioCtx();
  return audioContext;
};

export const primeMessageSound = async () => {
  try {
    const ctx = getContext();
    if (ctx?.state === 'suspended') await ctx.resume();
  } catch (_) {
    // Audio is optional; browsers may block it until a user gesture.
  }
};

export const playIncomingMessageSound = async () => {
  if (!isMessageSoundEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    gain.connect(ctx.destination);

    const first = ctx.createOscillator();
    first.type = 'sine';
    first.frequency.setValueAtTime(740, now);
    first.connect(gain);
    first.start(now);
    first.stop(now + 0.11);

    const second = ctx.createOscillator();
    second.type = 'sine';
    second.frequency.setValueAtTime(880, now + 0.09);
    second.connect(gain);
    second.start(now + 0.09);
    second.stop(now + 0.22);
  } catch (_) {
    // Never let notification audio interfere with messaging.
  }
};
