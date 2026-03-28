/**
 * Audio Service using Web Audio API
 * Provides piano sound synthesis for the virtual keyboard
 */

class AudioService {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeOscillators: Map<string, {
    oscillators: OscillatorNode[];
    gain: GainNode;
  }> = new Map();
  private pendingNotes: Map<string, { frequency: number; duration: number }> = new Map();

  initialize(): void {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.audioContext.destination);
    console.log('[Audio] Context created, state:', this.audioContext.state);
  }

  playNote(note: string, frequency: number, duration: number = 0): void {
    if (!this.audioContext || !this.masterGain) {
      this.initialize();
    }
    if (!this.audioContext || !this.masterGain) {
      console.warn('Audio context not initialized');
      return;
    }

    // If context is suspended (Safari/Chrome first interaction), queue the note
    if (this.audioContext.state === 'suspended') {
      this.pendingNotes.set(note, { frequency, duration });
      this.audioContext.resume().then(() => {
        const pending = this.pendingNotes.get(note);
        if (pending) {
          this.pendingNotes.delete(note);
          this.startOscillators(note, pending.frequency, pending.duration);
        }
      });
      return;
    }

    this.startOscillators(note, frequency, duration);
  }

  private startOscillators(note: string, frequency: number, duration: number): void {
    if (!this.audioContext || !this.masterGain) return;

    this.stopNote(note);

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();

    const harmonics = [
      { multiplier: 1.0, amplitude: 1.0 },
      { multiplier: 2.0, amplitude: 0.4 },
      { multiplier: 3.0, amplitude: 0.2 },
      { multiplier: 4.0, amplitude: 0.15 },
      { multiplier: 5.0, amplitude: 0.1 },
    ];

    const oscillators: OscillatorNode[] = [];
    harmonics.forEach(({ multiplier, amplitude }) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = frequency * multiplier;
      osc.type = 'sine';

      const harmonicGain = ctx.createGain();
      harmonicGain.gain.value = amplitude;

      osc.connect(harmonicGain);
      harmonicGain.connect(gainNode);
      osc.start(now);
      oscillators.push(osc);
    });

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.9, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.5, now + 0.15);
    gainNode.connect(this.masterGain);

    this.activeOscillators.set(note, { oscillators, gain: gainNode });

    if (duration > 0) {
      setTimeout(() => this.stopNote(note), duration);
    }
  }

  stopNote(note: string): void {
    this.pendingNotes.delete(note); // cancel if not yet started
    const active = this.activeOscillators.get(note);
    if (!active || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setValueAtTime(active.gain.gain.value, now);
    active.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    active.oscillators.forEach(osc => osc.stop(now + 0.2));
    this.activeOscillators.delete(note);
  }

  stopAll(): void {
    this.activeOscillators.forEach((_, note) => this.stopNote(note));
    this.activeOscillators.clear();
  }

  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getVolume(): number {
    return this.masterGain?.gain.value || 0;
  }

  isInitialized(): boolean {
    return this.audioContext !== null;
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

export const audioService = new AudioService();
export default audioService;
