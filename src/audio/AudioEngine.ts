/**
 * AudioEngine for Beat Piano 3D
 * - Web Audio API with AnalyserNode (fftSize = 128)
 * - Synthesizes rich piano notes on impact
 * - Procedural Synthwave backing track (zero 404 dependencies)
 * - Custom MP3 audio loading capability
 * - Analyzes frequency bins to drive visual scene pulsation
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Analyser data
  private freqData: Uint8Array<ArrayBuffer> | null = null;

  // Backing track state
  private isPlaying = false;
  private bpm = 124;
  private nextBeatTime = 0;
  private currentStep = 0;
  private timerId: number | null = null;

  // Custom audio element/source (for MP3 loading)
  private customAudio: HTMLAudioElement | null = null;
  private customSource: MediaElementAudioSourceNode | null = null;
  private isUsingCustomAudio = false;

  // Chord progression: Am -> F -> C -> G
  private bassNotes = [110.0, 87.31, 130.81, 98.0]; // A2, F2, C3, G2
  private leadPitches = [
    [440, 523.25, 659.25, 523.25], // Am
    [349.23, 440, 523.25, 659.25], // F
    [261.63, 329.63, 392, 523.25], // C
    [392, 493.88, 587.33, 493.88]  // G
  ];

  constructor() {
    // Lazily initialize upon user interaction
  }

  public init(): boolean {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return true;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // AnalyserNode explicitly requested with fftSize = 128
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount); // 64 bins

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.65;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;

      // Routing
      this.musicGain.connect(this.analyser);
      this.sfxGain.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      return true;
    } catch (err) {
      console.warn('AudioContext failed to initialize:', err);
      return false;
    }
  }

  public startMusic() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.isUsingCustomAudio && this.customAudio) {
      this.customAudio.play().catch(e => console.warn('MP3 playback blocked:', e));
      this.isPlaying = true;
      return;
    }

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextBeatTime = this.ctx.currentTime + 0.1;
    this.scheduleRhythm();
  }

  public stopMusic() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.customAudio) {
      this.customAudio.pause();
    }
  }

  /**
   * Procedural synthwave sequencer loop
   */
  private scheduleRhythm = () => {
    if (!this.isPlaying || !this.ctx || !this.musicGain) return;

    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = secondsPerBeat / 4; // 16th notes
    const lookahead = 0.1; // seconds

    while (this.nextBeatTime < this.ctx.currentTime + lookahead) {
      this.triggerStep(this.nextBeatTime, this.currentStep);
      this.nextBeatTime += stepDuration;
      this.currentStep = (this.currentStep + 1) % 64; // 4-bar loop
    }

    this.timerId = window.setTimeout(this.scheduleRhythm, 25);
  };

  /**
   * Synthesize synthwave drums & bass arpeggio
   */
  private triggerStep(time: number, step: number) {
    if (!this.ctx || !this.musicGain) return;

    const isBeat = step % 4 === 0;
    const beatIndex = Math.floor(step / 4);
    const barIndex = Math.floor(step / 16);

    // 1. Kick drum on 1, 5, 9, 13 (four-on-the-floor)
    if (isBeat) {
      this.playKick(time);
    }

    // 2. Snare / Clap on beat 2 and 4 (step 4, 12, 20, 28, etc.)
    if (step % 8 === 4) {
      this.playSnare(time);
    }

    // 3. Hi-Hat on every 8th note
    if (step % 2 === 0) {
      this.playHiHat(time, step % 4 === 2 ? 0.35 : 0.2);
    }

    // 4. Rolling Synthwave Bassline (16th notes)
    const chordIdx = barIndex % 4;
    const baseFreq = this.bassNotes[chordIdx];
    // Octave wobble pattern
    const octave = (step % 4 === 0 || step % 4 === 2) ? 1 : 2;
    this.playSynthBass(time, baseFreq * octave, 0.09);

    // 5. Arpeggiator sparkle on offbeats
    if (step % 2 === 1) {
      const notes = this.leadPitches[chordIdx];
      const noteFreq = notes[step % notes.length];
      this.playArpLead(time, noteFreq, 0.12);
    }
  }

  private playKick(time: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.15);

    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.25);
  }

  private playSnare(time: number) {
    if (!this.ctx || !this.musicGain) return;

    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.15);
  }

  private playHiHat(time: number, vol = 0.2) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, time);

    filter.type = 'highpass';
    filter.frequency.value = 7000;

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  private playSynthBass(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + duration);

    gain.gain.setValueAtTime(0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playArpLead(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Rich Piano Note Synthesizer
   * Combines fundamental sine, harmonic triangle, soft hammer transient,
   * and acoustic decay curve for realistic presence.
   */
  public playPianoNote(freq: number, velocity = 1.0) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const duration = 1.8;

    // 1. Fundamental
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // 2. Harmonic overtone (richness)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);

    // 3. Subtle 3rd harmonic
    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, now);

    // Filter to simulate wooden soundboard warmth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 5, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, now + duration);

    // Master Note Envelope (ADSR: instantaneous attack, steep initial decay, natural tail)
    const noteGain = this.ctx.createGain();
    const peak = 0.8 * velocity;
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(peak, now + 0.008);
    noteGain.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.25);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Harmonic gain blends
    const harmGain = this.ctx.createGain();
    harmGain.gain.value = 0.35;
    osc2.connect(harmGain);
    harmGain.connect(filter);

    const harmGain3 = this.ctx.createGain();
    harmGain3.gain.value = 0.15;
    osc3.connect(harmGain3);
    harmGain3.connect(filter);

    osc1.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  }

  /**
   * Dull miss / thud sound
   */
  public playMissSound() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Load custom MP3 from File or URL
   */
  public loadMp3FromFile(file: File) {
    this.init();
    if (!this.ctx || !this.musicGain) return;

    this.stopMusic();

    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.src = '';
    }

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.loop = true;

    this.customAudio = audio;
    this.isUsingCustomAudio = true;

    if (!this.customSource) {
      this.customSource = this.ctx.createMediaElementSource(audio);
      this.customSource.connect(this.musicGain);
    }

    this.startMusic();
  }

  /**
   * Frequency data from AnalyserNode (fftSize = 128 -> 64 bins)
   */
  public getFrequencyData(): Uint8Array {
    if (!this.analyser || !this.freqData) {
      return new Uint8Array(64);
    }
    (this.analyser as unknown as { getByteFrequencyData: (arr: Uint8Array) => void }).getByteFrequencyData(this.freqData);
    return this.freqData;
  }

  /**
   * Normalized bass punch [0.0, 1.0] for reactive visuals
   */
  public getBassIntensity(): number {
    const data = this.getFrequencyData();
    if (data.length === 0) return 0;
    // Bins 1 to 4 cover ~40Hz to ~160Hz
    const bassSum = data[1] + data[2] + data[3] + data[4];
    return Math.min(1.0, bassSum / (4 * 255));
  }

  public setVolume(volume: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    if (!this.masterGain || !this.ctx) return true;
    const isMuted = this.masterGain.gain.value === 0;
    this.masterGain.gain.setValueAtTime(isMuted ? 0.85 : 0, this.ctx.currentTime);
    return !isMuted;
  }
}
