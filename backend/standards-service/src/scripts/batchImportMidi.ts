import { midiParser } from '../utils/midiParser';
import { query } from '../config/db';
import fs from 'fs';
import path from 'path';

interface MidiFileInfo {
  filename: string;
  fullPath: string;
  title: string;
  bookSource: string;
}

async function main() {
  const forceReimport = process.argv.includes('--force');
  const midiFolder = process.argv.find(arg => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1]) || '../../midi-files/standards';
  const midiPath = path.resolve(process.cwd(), midiFolder);

  console.log('🎵 Jazz MIDI Batch Importer\n');
  if (forceReimport) {
    console.log('⚠️  FORCE MODE: Will delete and re-import all standards\n');
  }
  console.log('='.repeat(60));
  console.log(`📁 Scanning folder: ${midiPath}\n`);

  // Check if folder exists
  if (!fs.existsSync(midiPath)) {
    console.error(`❌ Folder not found: ${midiPath}`);
    process.exit(1);
  }

  // Get all MIDI files from subfolders (book sources)
  const midiFiles: MidiFileInfo[] = [];
  const subfolders = fs.readdirSync(midiPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory());

  if (subfolders.length === 0) {
    console.log('❌ No book source subfolders found in the standards folder');
    console.log('   Please organize MIDI files into subfolders (e.g., real-book-1/)');
    process.exit(0);
  }

  for (const subfolder of subfolders) {
    const bookSource = subfolder.name;
    const subfolderPath = path.join(midiPath, bookSource);
    const files = fs.readdirSync(subfolderPath)
      .filter(file => file.toLowerCase().endsWith('.mid') || file.toLowerCase().endsWith('.midi'));

    for (const filename of files) {
      midiFiles.push({
        filename,
        fullPath: path.join(subfolderPath, filename),
        title: capitalizeTitle(filename.replace(/\.(mid|midi)$/i, '')),
        bookSource
      });
    }
  }

  if (midiFiles.length === 0) {
    console.log('❌ No MIDI files found in any subfolder');
    process.exit(0);
  }

  console.log(`📄 Found ${midiFiles.length} MIDI file(s) across ${subfolders.length} book source(s):\n`);
  midiFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. [${file.bookSource}] ${file.filename} → "${file.title}"`);
  });

  // Handle force reimport
  if (forceReimport) {
    console.log('\n🗑️  Deleting all existing standards for re-import...');
    const deleteResult = await query('DELETE FROM jazz_standards');
    console.log(`   Deleted ${deleteResult.rowCount} standard(s)\n`);
  }

  // Get existing standards from database (keyed by title + book_source to allow variants)
  console.log('\n📊 Checking database for existing standards...\n');
  const result = await query('SELECT title, book_source FROM jazz_standards');
  const existingKeys = new Set(result.rows.map(row => `${row.title.toLowerCase()}|${row.book_source}`));

  console.log(`   Database has ${existingKeys.size} standard(s)`);

  // Filter out already imported files (same title + same book source = already imported)
  const newFiles = midiFiles.filter(file => !existingKeys.has(`${file.title.toLowerCase()}|${file.bookSource}`));

  if (newFiles.length === 0) {
    console.log('\n✅ All MIDI files are already in the database!');
    console.log('\n' + '='.repeat(60));
    process.exit(0);
  }

  console.log(`\n🆕 Found ${newFiles.length} new file(s) to import:\n`);
  newFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. [${file.bookSource}] ${file.title}`);
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
          id, title, composer, year, key, time_signature, interval_sequence, duration_ratios, book_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          file.title,
          composer,
          year,
          key,
          '4/4',
          melody.intervalSequence,
          melody.durationRatios,
          file.bookSource
        ]
      );

      console.log(`✅ Imported successfully!`);
      console.log(`   - Book source: ${file.bookSource}`);
      console.log(`   - Notes: ${melody.notes.length}`);
      console.log(`   - Intervals: ${melody.intervalSequence.length}`);
      console.log(`   - Duration ratios: ${melody.durationRatios.length}`);
      console.log(`   - First intervals: [${melody.intervalSequence.slice(0, 8).join(', ')}...]`);
      console.log(`   - First ratios (x4): [${melody.durationRatios.slice(0, 8).join(', ')}...]`);
      successCount++;

    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
      errorCount++;
    }
  }

  // Update standards-list.txt with all imported standards
  const standardsListPath = path.resolve(midiPath, '..', 'standards-list.txt');
  const allTitles = midiFiles
    .map(f => `${f.bookSource}: ${f.title}`)
    .sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(standardsListPath, allTitles.join('\n') + '\n');
  console.log(`\n📝 Updated ${standardsListPath} (${allTitles.length} standards)`);

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
