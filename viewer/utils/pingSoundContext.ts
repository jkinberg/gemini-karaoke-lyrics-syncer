// Shared AudioContext for ping sounds
// Must be initialized on user gesture (e.g., tap to unmute) to work on mobile

let pingAudioContext: AudioContext | null = null;

export function initPingSoundContext(): void {
  if (pingAudioContext) return;

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    pingAudioContext = new AudioContextClass();
  } catch (e) {
    console.debug('Could not create ping AudioContext:', e);
  }
}

export function playPingSound(): void {
  // If context doesn't exist, try to create it (will fail on mobile without gesture)
  if (!pingAudioContext) {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      pingAudioContext = new AudioContextClass();
    } catch (e) {
      console.debug('Could not create ping AudioContext:', e);
      return;
    }
  }

  const ctx = pingAudioContext;

  try {
    // Resume if suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Create oscillator for the ping tone
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Configure the ping sound - a pleasant chime
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1); // E6
    oscillator.type = 'sine';

    // Envelope: quick attack, short sustain, fade out
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.debug('Could not play ping sound:', e);
  }
}
