/**
 * intervalsToMidi.ts
 * Generate a MIDI file from an interval sequence and optional duration ratios.
 *
 * Usage:
 *   npx ts-node src/scripts/intervalsToMidi.ts \
 *     --intervals "7, 1, -8, -4, 6" \
 *     --ratios "6, 4, 6, 4, 12" \
 *     --root 60 \
 *     --bpm 120 \
 *     --out output.mid
 *
 * --intervals  comma-separated semitone differences (required)
 * --ratios     comma-separated duration ratios (optional, defaults to equal)
 * --root       starting MIDI note number (default: 60 = C4)
 * --bpm        tempo in BPM (default: 120)
 * --out        output file path (default: output.mid)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Midi } from '@tonejs/midi';

function parseArg(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

function parseIntList(s: string): number[] {
  return s.split(',').map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x));
}

const args = process.argv.slice(2);

const intervalsArg = parseArg(args, '--intervals');
if (!intervalsArg) {
  console.error('Error: --intervals is required');
  console.error('Example: --intervals "7, 1, -8, -4, 6"');
  process.exit(1);
}

const intervals = parseIntList(intervalsArg);
const ratiosArg = parseArg(args, '--ratios');
const ratios = ratiosArg ? parseIntList(ratiosArg) : [];
const rootMidi = parseInt(parseArg(args, '--root') ?? '60', 10);
const bpm = parseInt(parseArg(args, '--bpm') ?? '120', 10);
const outFile = parseArg(args, '--out') ?? 'output.mid';

// Build note sequence from intervals (intervals.length + 1 notes)
const midiNotes: number[] = [rootMidi];
for (const interval of intervals) {
  midiNotes.push(midiNotes[midiNotes.length - 1] + interval);
}

// Duration ratios → actual durations in seconds
// If no ratios provided, use equal duration (1 beat each)
const beatDuration = 60 / bpm; // seconds per beat

let durations: number[];
if (ratios.length >= midiNotes.length) {
  // Ratios cover all notes
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  const totalBeats = midiNotes.length; // assume total = n beats
  durations = ratios.slice(0, midiNotes.length).map(r => (r / totalRatio) * totalBeats * beatDuration);
} else if (ratios.length >= intervals.length) {
  // Ratios correspond to intervals (n-1 notes); last note gets average duration
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const allRatios = [...ratios, avg];
  const totalRatio = allRatios.reduce((a, b) => a + b, 0);
  const totalBeats = midiNotes.length;
  durations = allRatios.map(r => (r / totalRatio) * totalBeats * beatDuration);
} else {
  // No ratios — equal duration
  durations = midiNotes.map(() => beatDuration);
}

// Build MIDI
const midi = new Midi();
midi.header.setTempo(bpm);
const track = midi.addTrack();

let time = 0;
for (let i = 0; i < midiNotes.length; i++) {
  const note = midiNotes[i];
  if (note < 0 || note > 127) {
    console.warn(`  Skipping out-of-range MIDI note: ${note}`);
    time += durations[i];
    continue;
  }
  track.addNote({
    midi: note,
    time,
    duration: durations[i] * 0.9, // slight gap between notes
    velocity: 0.8,
  });
  time += durations[i];
}

// Write file
const outPath = path.resolve(outFile);
fs.writeFileSync(outPath, Buffer.from(midi.toArray()));

// Summary
const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const noteLabels = midiNotes.map(n => `${noteNames[n % 12]}${Math.floor(n / 12) - 1}`);

console.log(`Generated: ${outPath}`);
console.log(`  Notes:     ${noteLabels.join(' → ')}`);
console.log(`  Intervals: [${intervals.join(', ')}]`);
if (ratios.length) console.log(`  Ratios:    [${ratios.join(', ')}]`);
console.log(`  BPM: ${bpm}, root: ${noteLabels[0]}, duration: ${time.toFixed(2)}s`);
