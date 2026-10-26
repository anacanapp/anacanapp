class CozyAudio {
  private context?: AudioContext;
  private gain?: GainNode;
  private enabled = true;
  private timer?: ReturnType<typeof setInterval>;
  private noteIndex = 0;

  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.gain = this.context.createGain();
        this.gain.gain.value = .11; this.gain.connect(this.context.destination);
      }
      void this.context.resume();
      if (!this.timer) this.timer = setInterval(() => {
        if (!this.enabled || document.hidden || this.context?.state !== 'running') return;
        const notes = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66, 261.63, 349.23, 440, 523.25];
        this.tone(notes[this.noteIndex++ % notes.length], 1.8, .13, 'sine');
      }, 2400);
    } catch { /* audio is an optional experience */ }
  }

  enable(enabled: boolean) { this.enabled = enabled; }

  private tone(frequency: number, seconds: number, volume: number, type: OscillatorType, delay = 0) {
    const context = this.context;
    if (!this.enabled || !context || !this.gain || context.state !== 'running') return;
    const oscillator = context.createOscillator(), envelope = context.createGain(), time = context.currentTime + delay;
    oscillator.type = type; oscillator.frequency.value = frequency; oscillator.connect(envelope); envelope.connect(this.gain);
    envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(volume, time + .025);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + seconds);
    oscillator.start(time); oscillator.stop(time + seconds + .04);
  }

  tap() { this.tone(660, .12, .18, 'sine'); }
  success() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, .65, .3, 'sine', i * .09)); }
  sparkle() { this.tone(1174.66, .35, .16, 'sine'); }
  dispose() { clearInterval(this.timer); void this.context?.close(); }
}

export const audio = new CozyAudio();
