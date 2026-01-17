/**
 * Keyboard Mapping Service
 * Maps PC keyboard keys to piano notes
 */

export interface KeyboardMapping {
  key: string;           // Keyboard key (e.g., 'a', 'w')
  note: string;          // Piano note (e.g., 'C4', 'C#4')
  displayKey: string;    // What to display on UI (e.g., 'A', 'W')
}

/**
 * Map keyboard keys to one octave of piano notes
 * Using two rows of keyboard:
 * - Top row (number keys): Black keys (sharps)
 * - Bottom row (letter keys): White keys
 *
 * Layout:
 *   2  3     5  6  7     9  0
 * A  S  D  F  G  H  J  K  L  ;  '  ]
 *
 * Maps to piano:
 *   C# D#    F# G# A#    C# D#
 * C  D  E  F  G  A  B  C  D  E  F  F#
 */

class KeyboardMappingService {
  private baseOctave = 4; // Default to C4-B4

  /**
   * Get keyboard to note mappings for current octave
   */
  getMappings(): KeyboardMapping[] {
    const octave = this.baseOctave;
    const nextOctave = octave + 1;

    return [
      // White keys (bottom row) - 12 keys for one octave + extra
      { key: 'a', note: `C${octave}`, displayKey: 'A' },
      { key: 's', note: `D${octave}`, displayKey: 'S' },
      { key: 'd', note: `E${octave}`, displayKey: 'D' },
      { key: 'f', note: `F${octave}`, displayKey: 'F' },
      { key: 'g', note: `G${octave}`, displayKey: 'G' },
      { key: 'h', note: `A${octave}`, displayKey: 'H' },
      { key: 'j', note: `B${octave}`, displayKey: 'J' },
      { key: 'k', note: `C${nextOctave}`, displayKey: 'K' },
      { key: 'l', note: `D${nextOctave}`, displayKey: 'L' },
      { key: ';', note: `E${nextOctave}`, displayKey: ';' },
      { key: "'", note: `F${nextOctave}`, displayKey: "'" },
      { key: ']', note: `F#${nextOctave}`, displayKey: ']' },

      // Black keys (top row)
      { key: 'w', note: `C#${octave}`, displayKey: 'W' },
      { key: 'e', note: `D#${octave}`, displayKey: 'E' },
      { key: 't', note: `F#${octave}`, displayKey: 'T' },
      { key: 'y', note: `G#${octave}`, displayKey: 'Y' },
      { key: 'u', note: `A#${octave}`, displayKey: 'U' },
      { key: 'o', note: `C#${nextOctave}`, displayKey: 'O' },
      { key: 'p', note: `D#${nextOctave}`, displayKey: 'P' },
    ];
  }

  /**
   * Get note for a keyboard key
   */
  getNoteForKey(key: string): string | null {
    const mapping = this.getMappings().find(m => m.key === key.toLowerCase());
    return mapping ? mapping.note : null;
  }

  /**
   * Get keyboard key for a piano note
   */
  getKeyForNote(note: string): string | null {
    const mapping = this.getMappings().find(m => m.note === note);
    return mapping ? mapping.displayKey : null;
  }

  /**
   * Shift octave up
   */
  octaveUp(): number {
    if (this.baseOctave < 6) {
      this.baseOctave++;
    }
    return this.baseOctave;
  }

  /**
   * Shift octave down
   */
  octaveDown(): number {
    if (this.baseOctave > 2) {
      this.baseOctave--;
    }
    return this.baseOctave;
  }

  /**
   * Set specific octave
   */
  setOctave(octave: number): void {
    if (octave >= 2 && octave <= 6) {
      this.baseOctave = octave;
    }
  }

  /**
   * Get current octave
   */
  getOctave(): number {
    return this.baseOctave;
  }

  /**
   * Check if a key is mapped
   */
  isKeyMapped(key: string): boolean {
    return this.getMappings().some(m => m.key === key.toLowerCase());
  }
}

// Export singleton instance
export const keyboardMapping = new KeyboardMappingService();
export default keyboardMapping;
