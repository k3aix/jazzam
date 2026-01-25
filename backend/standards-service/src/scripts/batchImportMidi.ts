import { midiParser } from '../utils/midiParser';
import { query } from '../config/db';
import fs from 'fs';
import path from 'path';

interface MidiFileInfo {
  filename: string;
  fullPath: string;
  title: string;
}

async function main() {
  const midiFolder = process.argv[2] || '../../midi-files/standards';
  const midiPath = path.resolve(process.cwd(), midiFolder);

  console.log('🎵 Jazz MIDI Batch Importer\n');
  console.log('='.repeat(60));
  console.log(`📁 Scanning folder: ${midiPath}\n`);

  // Check if folder exists
  if (!fs.existsSync(midiPath)) {
    console.error(`❌ Folder not found: ${midiPath}`);
    process.exit(1);
  }

  // Get all MIDI files
  const files = fs.readdirSync(midiPath)
    .filter(file => file.toLowerCase().endsWith('.mid') || file.toLowerCase().endsWith('.midi'));

  if (files.length === 0) {
    console.log('❌ No MIDI files found in the folder');
    process.exit(0);
  }

  const midiFiles: MidiFileInfo[] = files.map(filename => ({
    filename,
    fullPath: path.join(midiPath, filename),
    title: capitalizeTitle(filename.replace(/\.(mid|midi)$/i, ''))
  }));

  console.log(`📄 Found ${midiFiles.length} MIDI file(s):\n`);
  midiFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file.filename} → "${file.title}"`);
  });

  // Get existing standards from database
  console.log('\n📊 Checking database for existing standards...\n');
  const result = await query('SELECT title FROM jazz_standards');
  const existingTitles = new Set(result.rows.map(row => row.title.toLowerCase()));

  console.log(`   Database has ${existingTitles.size} standard(s)`);

  // Filter out already imported files
  const newFiles = midiFiles.filter(file => !existingTitles.has(file.title.toLowerCase()));

  if (newFiles.length === 0) {
    console.log('\n✅ All MIDI files are already in the database!');
    console.log('\n' + '='.repeat(60));
    process.exit(0);
  }

  console.log(`\n🆕 Found ${newFiles.length} new file(s) to import:\n`);
  newFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file.title}`);
  });

  // Process each new file
  console.log('\n' + '='.repeat(60));
  console.log('\n🚀 Starting import...\n');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i];
    console.log(`\n[${i + 1}/${newFiles.length}] Processing: ${file.title}`);
    console.log('-'.repeat(60));

    try {
      // Parse MIDI file
      const melody = await midiParser.parseMidiFile(file.fullPath);

      // Extract metadata from filename or use defaults
      const composer = extractComposer(file.filename) || 'Unknown';
      const year = extractYear(file.filename);
      const key = null; // Can be added later if encoded in filename

      // Insert into database
      const id = generateUUID();
      await query(
        `INSERT INTO jazz_standards (
          id, title, composer, year, key, time_signature, interval_sequence, book_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          melody.title,
          composer,
          year,
          key,
          '4/4',
          melody.intervalSequence,
          'Real Book'
        ]
      );

      console.log(`✅ Imported successfully!`);
      console.log(`   - Notes: ${melody.notes.length}`);
      console.log(`   - Intervals: ${melody.intervalSequence.length}`);
      console.log(`   - First intervals: [${melody.intervalSequence.slice(0, 8).join(', ')}...]`);
      successCount++;

    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Import Summary:\n');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📁 Total processed: ${newFiles.length}`);
  console.log('\n' + '='.repeat(60));
  console.log('');

  process.exit(errorCount > 0 ? 1 : 0);
}

function capitalizeTitle(title: string): string {
  return title
    .split(/[-_\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function extractComposer(filename: string): string | null {
  // Try to extract composer from filename patterns like "title-composer.mid"
  const match = filename.match(/[-_]([A-Za-z\s]+)\.(mid|midi)$/i);
  if (match) {
    return capitalizeTitle(match[1]);
  }
  return null;
}

function extractYear(filename: string): number | null {
  // Try to extract year from filename patterns like "title-1954.mid"
  const match = filename.match(/[-_](19\d{2}|20\d{2})/);
  return match ? parseInt(match[1]) : null;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
