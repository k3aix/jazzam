import { midiParser } from '../utils/midiParser';

// Get MIDI file path from command line arguments
const midiFilePath = process.argv[2];

if (!midiFilePath) {
  console.error('❌ Usage: npm run parse-midi <path-to-midi-file>');
  process.exit(1);
}

// Parse MIDI file
async function main() {
  try {
    console.log('🎵 Jazz MIDI Parser\n');
    console.log('=' .repeat(60));

    const melody = await midiParser.parseMidiFile(midiFilePath);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Parsing Complete!\n');

    console.log('📋 Results:');
    console.log('-'.repeat(60));
    console.log(`Title: ${melody.title}`);
    console.log(`Notes: ${melody.notes.length}`);
    console.log(`Intervals: ${melody.intervalSequence.length}`);
    console.log(`\nInterval Sequence:`);
    console.log(`[${melody.intervalSequence.join(', ')}]`);
    console.log(`\nOriginal Notes (first 10):`);
    console.log(melody.notes.slice(0, 10).map(n => n.name).join(' → '));

    console.log('\n' + '-'.repeat(60));
    console.log('\n💾 SQL Insert Statement:\n');

    const sqlStatement = midiParser.formatAsSql(
      melody,
      'Sonny Rollins', // You can customize this
      1954,            // You can customize this
      'Bb'             // You can customize this
    );

    console.log(sqlStatement);

    console.log('\n' + '='.repeat(60));
    console.log('\n✓ You can now copy the SQL statement above and run it in your database!');
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
