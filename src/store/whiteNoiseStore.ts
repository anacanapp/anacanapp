import { create } from 'zustand';

interface WhiteNoiseState {
  activeSoundId: string | null;
  soundName: string | null;
  soundEmoji: string | null;
  soundColor: string | null;
  noiseType: string | null;
  audioUrl: string | null;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;

  // Audio refs managed outside React
  _audioElement: HTMLAudioElement | null;
  _audioContext: AudioContext | null;
  _noiseSource: AudioBufferSourceNode | null;
  _gainNode: GainNode | null;

  play: (sound: {
    id: string;
    name: string;
    emoji: string;
    color: string;
    noiseType: string;
    audioUrl: string | null;
  }) => void;
  stop: () => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  toggleMute: () => void;
}

const generateNoiseBuffer = (ctx: AudioContext, type: string): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const duration = 4;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + (0.02 * white)) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return buffer;
};

const stopAudioInternal = (state: WhiteNoiseState) => {
  if (state._audioElement) {
    const audio = state._audioElement;
    audio.pause();
    // Assigning '' makes WebViews try to load the page URL as media; drop the
    // source and reset the element so the decoder/network buffer is released.
    if (typeof audio.removeAttribute === 'function' && typeof audio.load === 'function') {
      audio.removeAttribute('src');
      audio.load();
    } else {
      audio.src = '';
    }
  }
  if (state._noiseSource) {
    try { state._noiseSource.stop(); } catch {}
  }
  if (state._audioContext) {
    state._audioContext.close().catch(() => {});
  }
};

export const useWhiteNoiseStore = create<WhiteNoiseState>((set, get) => ({
  activeSoundId: null,
  soundName: null,
  soundEmoji: null,
  soundColor: null,
  noiseType: null,
  audioUrl: null,
  volume: 70,
  isMuted: false,
  isPlaying: false,
  _audioElement: null,
  _audioContext: null,
  _noiseSource: null,
  _gainNode: null,

  play: (sound) => {
    const state = get();
    // Stop existing audio
    stopAudioInternal(state);

    const effectiveVolume = state.isMuted ? 0 : state.volume / 100;

    if (sound.audioUrl) {
      const audio = new Audio(sound.audioUrl);
      audio.loop = true;
      audio.volume = effectiveVolume;
      audio.play().catch(err => console.warn('Audio play failed:', err));
      set({
        activeSoundId: sound.id,
        soundName: sound.name,
        soundEmoji: sound.emoji,
        soundColor: sound.color,
        noiseType: sound.noiseType,
        audioUrl: sound.audioUrl,
        isPlaying: true,
        _audioElement: audio,
        _audioContext: null,
        _noiseSource: null,
        _gainNode: null,
      });
    } else {
      const ctx = new AudioContext();
      const gainNode = ctx.createGain();
      gainNode.gain.value = effectiveVolume;
      gainNode.connect(ctx.destination);
      const buffer = generateNoiseBuffer(ctx, sound.noiseType);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gainNode);
      source.start();
      set({
        activeSoundId: sound.id,
        soundName: sound.name,
        soundEmoji: sound.emoji,
        soundColor: sound.color,
        noiseType: sound.noiseType,
        audioUrl: sound.audioUrl,
        isPlaying: true,
        _audioElement: null,
        _audioContext: ctx,
        _noiseSource: source,
        _gainNode: gainNode,
      });
    }
  },

  stop: () => {
    stopAudioInternal(get());
    set({
      activeSoundId: null,
      soundName: null,
      soundEmoji: null,
      soundColor: null,
      noiseType: null,
      audioUrl: null,
      isPlaying: false,
      _audioElement: null,
      _audioContext: null,
      _noiseSource: null,
      _gainNode: null,
    });
  },

  setVolume: (v) => {
    const state = get();
    const effectiveVolume = state.isMuted ? 0 : v / 100;
    if (state._audioElement) state._audioElement.volume = effectiveVolume;
    if (state._gainNode) {
      try {
        state._gainNode.gain.setValueAtTime(effectiveVolume, state._gainNode.context.currentTime);
      } catch {
        state._gainNode.gain.value = effectiveVolume;
      }
    }
    set({ volume: v });
  },

  setMuted: (m) => {
    const state = get();
    const effectiveVolume = m ? 0 : state.volume / 100;
    if (state._audioElement) state._audioElement.volume = effectiveVolume;
    if (state._gainNode) {
      try {
        state._gainNode.gain.setValueAtTime(effectiveVolume, state._gainNode.context.currentTime);
      } catch {
        state._gainNode.gain.value = effectiveVolume;
      }
    }
    set({ isMuted: m });
  },

  toggleMute: () => {
    get().setMuted(!get().isMuted);
  },
}));
