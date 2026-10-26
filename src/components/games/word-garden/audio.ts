export function createGardenAudio() {
  let context: AudioContext | undefined;
  return {
    play(kind: 'letter' | 'found' | 'bonus' | 'win', enabled: boolean) {
      if (!enabled) return;
      try {
        const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        context ||= new Constructor();
        void context.resume().catch(() => {});
        const frequencies = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'found' ? [659.25, 880] : kind === 'bonus' ? [783.99, 1046.5] : [440];
        for (const [index, frequency] of frequencies.entries()) {
          const start = context.currentTime + index * 0.09, oscillator = context.createOscillator(), gain = context.createGain();
          oscillator.type = 'sine'; oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(kind === 'letter' ? 0.025 : 0.055, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
          oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + 0.2);
        }
      } catch { /* Sound is optional, gameplay does not depend on an audio device. */ }
    },
    close() { void context?.close().catch(() => {}); context = undefined; },
  };
}
