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
  private currentNote: string | null = null; // For monophonic mode

  /**
   * Initialize the audio context
   * Must be called after user interaction (browser requirement)
   */
  initialize(): void {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.3; // Master volume (30%)
    this.masterGain.connect(this.audioContext.destination);
  }

  /**
   * Play a note with given frequency (monophonic - stops previous note)
   * @param note - Note name (e.g., "C4", "D#4")
   * @param frequency - Frequency in Hz
   * @param duration - Note duration in ms (0 = sustain until stop)
   */
  playNote(note: string, frequency: number, duration: number = 0): void {
    if (!this.audioContext || !this.masterGain) {
      this.initialize();
    }

    if (!this.audioContext || !this.masterGain) {
      console.warn('Audio context not initialized');
      return;
    }

    // Monophonic mode: stop any currently playing note
    if (this.currentNote && this.currentNote !== note) {
      this.stopNote(this.currentNote);
    }

    // Stop any existing note with same name
    this.stopNote(note);

    const now = this.audioContext.currentTime;

    // Create gain node for this note (for envelope)
    const gainNode = this.audioContext.createGain();

    // Piano-like sound using multiple harmonics (partials)
    const oscillators: OscillatorNode[] = [];

    // Fundamental frequency + harmonics with decreasing amplitudes
    const harmonics = [
      { multiplier: 1.0, amplitude: 1.0 },    // Fundamental
      { multiplier: 2.0, amplitude: 0.4 },    // 2nd harmonic (octave)
      { multiplier: 3.0, amplitude: 0.2 },    // 3rd harmonic (perfect fifth)
      { multiplier: 4.0, amplitude: 0.15 },   // 4th harmonic (2 octaves)
      { multiplier: 5.0, amplitude: 0.1 },    // 5th harmonic
    ];

    harmonics.forEach(({ multiplier, amplitude }) => {
      const osc = this.audioContext!.createOscillator();
      osc.frequency.value = frequency * multiplier;
      osc.type = 'sine';

      // Individual gain for this harmonic
      const harmonicGain = this.audioContext!.createGain();
      harmonicGain.gain.value = amplitude;

      osc.connect(harmonicGain);
      harmonicGain.connect(gainNode);
      osc.start(now);

      oscillators.push(osc);
    });

    // Piano ADSR Envelope
    // Attack: very fast (5ms) - piano has instant attack
    // Decay: medium (150ms) - initial brightness fades
    // Sustain: medium level (0.5) - note continues
    // Release: handled when stopNote is called
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.9, now + 0.005); // Very fast attack
    gainNode.gain.exponentialRampToValueAtTime(0.5, now + 0.15); // Decay to sustain

    // Connect to master output
    gainNode.connect(this.masterGain);

    // Store reference
    this.activeOscillators.set(note, { oscillators, gain: gainNode });
    this.currentNote = note;

    // If duration specified, auto-stop
    if (duration > 0) {
      setTimeout(() => this.stopNote(note), duration);
    }
  }

  /**
   * Stop playing a note
   * @param note - Note name to stop
   */
  stopNote(note: string): void {
    const active = this.activeOscillators.get(note);
    if (!active || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Piano release: fade out over 200ms (longer than simple synth)
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setValueAtTime(active.gain.gain.value, now);
    active.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Stop all oscillators (harmonics) after release
    active.oscillators.forEach(osc => {
      osc.stop(now + 0.2);
    });

    // Clean up
    this.activeOscillators.delete(note);

    if (this.currentNote === note) {
      this.currentNote = null;
    }
  }

  /**
   * Stop all playing notes
   */
  stopAll(): void {
    this.activeOscillators.forEach((_, note) => this.stopNote(note));
    this.activeOscillators.clear();
  }

  /**
   * Set master volume
   * @param volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get currently playing note (for monophonic mode)
   */
  getCurrentNote(): string | null {
    return this.currentNote;
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.masterGain?.gain.value || 0;
  }

  /**
   * Check if audio is initialized
   */
  isInitialized(): boolean {
    return this.audioContext !== null;
  }

  /**
   * Resume audio context (needed after browser auto-suspend)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();
export default audioService;
