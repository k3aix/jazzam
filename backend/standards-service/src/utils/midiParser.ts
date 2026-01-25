import { Midi } from '@tonejs/midi';
import fs from 'fs';

interface MelodyNote {
  midi: number;
  time: number;
  name: string;
}

interface ParsedMelody {
  title: string;
  notes: MelodyNote[];
  intervalSequence: number[];
  originalNotes: string;
}

export class MidiParser {
  /**
   * Parse a MIDI file and extract the melody with interval sequence
   */
  async parseMidiFile(filePath: string): Promise<ParsedMelody> {
    // Read the MIDI file
    const midiData = fs.readFileSync(filePath);
    const midi = new Midi(midiData);

    console.log(`\n📄 MIDI File: ${filePath}`);
    console.log(`   Tracks: ${midi.tracks.length}`);
    console.log(`   Duration: ${midi.duration.toFixed(2)}s`);
    console.log(`   Time Signature: ${midi.header.timeSignatures[0]?.timeSignature || '4/4'}`);

    // Find the track with the melody (usually has the most notes in melodic range)
    let melodyTrack = midi.tracks[0];
    let maxMelodicNotes = 0;

    midi.tracks.forEach((track, index) => {
      // Count notes in melodic range (C3-C6, MIDI 48-84)
      const melodicNotes = track.notes.filter(
        note => note.midi >= 48 && note.midi <= 84
      );

      console.log(`   Track ${index}: ${track.name || 'Unnamed'} - ${track.notes.length} notes (${melodicNotes.length} melodic)`);

      if (melodicNotes.length > maxMelodicNotes) {
        maxMelodicNotes = melodicNotes.length;
        melodyTrack = track;
      }
    });

    // Extract notes sorted by time
    const notes: MelodyNote[] = melodyTrack.notes
      .map(note => ({
        midi: note.midi,
        time: note.time,
        name: note.name
      }))
      .sort((a, b) => a.time - b.time);

    if (notes.length === 0) {
      throw new Error('No notes found in MIDI file');
    }

    console.log(`\n✓ Selected melody track with ${notes.length} notes`);
    console.log(`   First notes: ${notes.slice(0, 5).map(n => n.name).join(' → ')}`);

    // Calculate interval sequence (semitone differences)
    const intervalSequence: number[] = [];
    for (let i = 1; i < notes.length; i++) {
      const interval = notes[i].midi - notes[i - 1].midi;
      intervalSequence.push(interval);
    }

    // Create original notes string
    const originalNotes = notes.map(n => n.name).join(' ');

    // Extract title from filename
    const title = filePath.split('/').pop()?.replace('.mid', '') || 'Unknown';

    console.log(`\n📊 Interval Analysis:`);
    console.log(`   Total intervals: ${intervalSequence.length}`);
    console.log(`   Range: ${Math.min(...intervalSequence)} to ${Math.max(...intervalSequence)} semitones`);
    console.log(`   First 10 intervals: [${intervalSequence.slice(0, 10).join(', ')}]`);

    return {
      title,
      notes,
      intervalSequence,
      originalNotes
    };
  }

  /**
   * Format parsed melody as SQL INSERT statement
   */
  formatAsSql(melody: ParsedMelody, composer?: string, year?: number, key?: string): string {
    const id = this.generateUUID();
    const title = this.capitalizeTitle(melody.title);

    return `
-- ${title}
INSERT INTO jazz_standards (
  id, title, composer, year, key, time_signature,
  interval_sequence, original_notes, book_source, page_number
) VALUES (
  '${id}',
  '${title}',
  ${composer ? `'${composer}'` : 'NULL'},
  ${year || 'NULL'},
  ${key ? `'${key}'` : 'NULL'},
  '4/4',
  ARRAY[${melody.intervalSequence.join(', ')}],
  '${melody.originalNotes.substring(0, 200)}${melody.originalNotes.length > 200 ? '...' : ''}',
  'Real Book',
  NULL
);
`;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private capitalizeTitle(title: string): string {
    return title
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export const midiParser = new MidiParser();
