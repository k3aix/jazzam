import { Midi } from '@tonejs/midi';
import fs from 'fs';
import path from 'path';

interface FileReport {
  filename: string;
  bookSource: string;
  totalNotes: number;
  simultaneousOnsets: number;
  overlappingNotes: number;
  overlapPercent: number;
  maxSimultaneous: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

function analyzeFile(filePath: string, threshold: number): FileReport {
  const midiData = fs.readFileSync(filePath);
  const midi = new Midi(midiData);

  // Select melody track: track with most notes in melodic range (C3-C6)
  let melodyTrack = midi.tracks[0];
  let maxMelodicNotes = 0;

  midi.tracks.forEach((track) => {
    const melodicNotes = track.notes.filter(
      note => note.midi >= 48 && note.midi <= 84
    );
    if (melodicNotes.length > maxMelodicNotes) {
      maxMelodicNotes = melodicNotes.length;
      melodyTrack = track;
    }
  });

  if (!melodyTrack || melodyTrack.notes.length === 0) {
    return {
      filename: path.basename(filePath),
      bookSource: path.basename(path.dirname(filePath)),
      totalNotes: 0,
      simultaneousOnsets: 0,
      overlappingNotes: 0,
      overlapPercent: 0,
      maxSimultaneous: 0,
      status: 'WARN',
    };
  }

  const notes = [...melodyTrack.notes].sort((a, b) => a.time - b.time);
  const totalNotes = notes.length;

  // Count simultaneous onsets (notes starting within 10ms of each other)
  let simultaneousOnsets = 0;
  for (let i = 1; i < notes.length; i++) {
    if (Math.abs(notes[i].time - notes[i - 1].time) < 0.01) {
      simultaneousOnsets++;
    }
  }

  // Count overlapping notes (note starts while a previous note is still sounding)
  let overlappingNotes = 0;
  let maxSimultaneous = 1;

  for (let i = 0; i < notes.length; i++) {
    // Count how many notes are sounding at this note's onset
    let concurrent = 0;
    for (let j = 0; j < i; j++) {
      const endTime = notes[j].time + notes[j].duration;
      if (notes[i].time < endTime - 0.01) {
        concurrent++;
      }
    }
    if (concurrent > 0) {
      overlappingNotes++;
    }
    maxSimultaneous = Math.max(maxSimultaneous, concurrent + 1);
  }

  const overlapPercent = totalNotes > 0
    ? (overlappingNotes / totalNotes) * 100
    : 0;

  let status: 'PASS' | 'WARN' | 'FAIL';
  if (overlapPercent > threshold) {
    status = 'FAIL';
  } else if (overlapPercent > 0) {
    status = 'WARN';
  } else {
    status = 'PASS';
  }

  return {
    filename: path.basename(filePath),
    bookSource: path.basename(path.dirname(filePath)),
    totalNotes,
    simultaneousOnsets,
    overlappingNotes,
    overlapPercent,
    maxSimultaneous,
    status,
  };
}

function main() {
  const args = process.argv.slice(2);
  const thresholdIdx = args.indexOf('--threshold');
  const threshold = thresholdIdx >= 0 ? parseFloat(args[thresholdIdx + 1]) : 5;
  const verbose = args.includes('--verbose');

  const midiFolder = args.find(arg => !arg.startsWith('-') && (thresholdIdx < 0 || arg !== args[thresholdIdx + 1]))
    || '../../midi-files/standards';
  const midiPath = path.resolve(process.cwd(), midiFolder);

  console.log('🔍 MIDI Sanity Check - Polyphony Detector\n');
  console.log('='.repeat(70));
  console.log(`📁 Scanning: ${midiPath}`);
  console.log(`   Overlap threshold: ${threshold}%\n`);

  if (!fs.existsSync(midiPath)) {
    console.error(`❌ Folder not found: ${midiPath}`);
    process.exit(1);
  }

  // Collect all MIDI files from subfolders
  const midiFiles: string[] = [];
  const subfolders = fs.readdirSync(midiPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory());

  for (const folder of subfolders) {
    const folderPath = path.join(midiPath, folder.name);
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.mid') || f.endsWith('.midi'))
      .map(f => path.join(folderPath, f));
    midiFiles.push(...files);
  }

  // Also check root-level MIDI files
  const rootFiles = fs.readdirSync(midiPath)
    .filter(f => (f.endsWith('.mid') || f.endsWith('.midi')) && fs.statSync(path.join(midiPath, f)).isFile())
    .map(f => path.join(midiPath, f));
  midiFiles.push(...rootFiles);

  console.log(`Found ${midiFiles.length} MIDI files\n`);

  if (midiFiles.length === 0) {
    console.log('No MIDI files found.');
    process.exit(0);
  }

  // Analyze each file
  const reports: FileReport[] = [];
  for (const file of midiFiles) {
    try {
      const report = analyzeFile(file, threshold);
      reports.push(report);
    } catch (err) {
      console.error(`❌ Error parsing ${path.basename(file)}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Print results table
  const passed = reports.filter(r => r.status === 'PASS');
  const warned = reports.filter(r => r.status === 'WARN');
  const failed = reports.filter(r => r.status === 'FAIL');

  if (verbose) {
    console.log('-'.repeat(90));
    console.log(
      'File'.padEnd(40) +
      'Notes'.padStart(6) +
      'Simult'.padStart(8) +
      'Overlap'.padStart(8) +
      'Pct'.padStart(7) +
      'MaxVoices'.padStart(10) +
      '  Status'
    );
    console.log('-'.repeat(90));

    for (const r of reports) {
      const statusIcon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️ ' : '❌';
      console.log(
        r.filename.padEnd(40).substring(0, 40) +
        String(r.totalNotes).padStart(6) +
        String(r.simultaneousOnsets).padStart(8) +
        String(r.overlappingNotes).padStart(8) +
        `${r.overlapPercent.toFixed(1)}%`.padStart(7) +
        String(r.maxSimultaneous).padStart(10) +
        `  ${statusIcon} ${r.status}`
      );
    }
    console.log('-'.repeat(90));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total files:   ${reports.length}`);
  console.log(`  ✅ PASS:        ${passed.length} (pure melody)`);
  console.log(`  ⚠️  WARN:        ${warned.length} (minor overlaps, <${threshold}%)`);
  console.log(`  ❌ FAIL:        ${failed.length} (polyphonic, >${threshold}% overlaps)`);

  if (failed.length > 0) {
    console.log('\n❌ FAILED FILES (likely polyphonic):');
    console.log('-'.repeat(70));
    for (const r of failed) {
      console.log(
        `  ${r.bookSource}/${r.filename}` +
        `  — ${r.overlappingNotes}/${r.totalNotes} overlaps (${r.overlapPercent.toFixed(1)}%)` +
        `, max ${r.maxSimultaneous} simultaneous voices`
      );
    }
  }

  if (warned.length > 0) {
    console.log('\n⚠️  WARNED FILES (minor overlaps):');
    console.log('-'.repeat(70));
    for (const r of warned) {
      console.log(
        `  ${r.bookSource}/${r.filename}` +
        `  — ${r.overlappingNotes}/${r.totalNotes} overlaps (${r.overlapPercent.toFixed(1)}%)` +
        `, max ${r.maxSimultaneous} simultaneous voices`
      );
    }
  }

  console.log('');
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
