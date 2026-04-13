/**
 * Import jazz standards from a pre-computed JSON sequence file.
 *
 * Expected JSON format:
 *   Array of { title, composer, key, meter, rhythm_style, note_count,
 *               intervals: number[], rhythm: number[], ... }
 *
 * The `rhythm` field contains note durations as beat fractions (e.g. 0.25, 0.5).
 * These are converted to integer ratios by multiplying by 16 (same scale as DB).
 *
 * Optional titles file (same name as JSON + ".titles.txt"):
 *   Controls which entries to import and under what title.
 *   Format per line:
 *     Original Title              ← import as-is
 *     Original Title => New Title ← import but store under "New Title"
 *     # Original Title            ← skip this entry
 *   If the file does not exist, all entries are imported.
 *
 * Usage:
 *   npx ts-node src/scripts/importJsonSequences.ts <json-file> [--book-source <name>] [--force]
 */

import { query } from '../config/db';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

interface JsonEntry {
  title: string;
  composer?: string;
  key?: string;
  meter?: string;
  rhythm_style?: string;
  note_count?: number;
  intervals: number[];
  rhythm: number[];
}

/** null = skip, string = title to store under (may differ from entry.title) */
type TitleDirective = string | null;

function loadTitlesFile(titlesPath: string): Map<string, TitleDirective> | null {
  if (!fs.existsSync(titlesPath)) return null;

  const map = new Map<string, TitleDirective>();
  const lines = fs.readFileSync(titlesPath, 'utf-8').split('\n');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      // Commented out — extract the original title and mark as skip
      const original = line.slice(1).split('=>')[0].trim();
      if (original) map.set(original.toLowerCase(), null);
      continue;
    }

    const parts = line.split('=>');
    const original = parts[0].trim();
    const alias = parts[1]?.trim() ?? original;
    if (original) map.set(original.toLowerCase(), alias);
  }

  return map;
}

async function main() {
  const args = process.argv.slice(2);

  const jsonFile = args.find(a => !a.startsWith('-') && a !== args[args.indexOf('--book-source') + 1]);
  const bookSourceIdx = args.indexOf('--book-source');
  const bookSource = bookSourceIdx !== -1 ? args[bookSourceIdx + 1] : 'json-import';
  const force = args.includes('--force');

  if (!jsonFile) {
    console.error('Usage: importJsonSequences.ts <json-file> [--book-source <name>] [--force]');
    process.exit(1);
  }

  const jsonPath = path.resolve(process.cwd(), jsonFile);
  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    process.exit(1);
  }

  // Auto-detect companion titles file
  const titlesPath = jsonPath + '.titles.txt';
  const titlesMap = loadTitlesFile(titlesPath);

  const entries: JsonEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`\n🎵 JSON Sequence Importer`);
  console.log(`${'='.repeat(60)}`);
  console.log(`File:        ${path.basename(jsonPath)}`);
  console.log(`Entries:     ${entries.length}`);
  console.log(`Book source: ${bookSource}`);
  if (titlesMap) {
    const active = [...titlesMap.values()].filter(v => v !== null).length;
    const skippedCount = [...titlesMap.values()].filter(v => v === null).length;
    const aliased = [...titlesMap.entries()].filter(([k, v]) => v !== null && v.toLowerCase() !== k).length;
    console.log(`Titles file: ${path.basename(titlesPath)} (${active} active, ${skippedCount} skipped, ${aliased} aliased)`);
  } else {
    console.log(`Titles file: none (importing all entries)`);
  }
  if (force) console.log(`Mode:        FORCE (re-import all)\n`);

  if (force) {
    const del = await query('DELETE FROM jazz_standards WHERE book_source = $1', [bookSource]);
    console.log(`Deleted ${del.rowCount} existing entries for book_source="${bookSource}"\n`);
  }

  // Load ALL existing (title, interval_sequence) pairs from the whole DB.
  // Dedup key: same title + same sequence = true duplicate, skip it.
  // Same title + different sequence = valid new variant, insert it.
  const existing = await query('SELECT title, interval_sequence FROM jazz_standards');
  const existingKeys = new Set<string>(
    existing.rows.map((r: { title: string; interval_sequence: number[] }) =>
      `${r.title.toLowerCase().trim()}|${r.interval_sequence.join(',')}`
    )
  );
  const existingTitles = new Set<string>(
    existing.rows.map((r: { title: string }) => r.title.toLowerCase().trim())
  );
  console.log(`Total entries in DB: ${existing.rows.length} across all sources\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const originalTitle = (entry.title ?? '').trim();
    if (!originalTitle) { skipped++; continue; }

    // Apply titles file directives
    let storeTitle = originalTitle;
    if (titlesMap) {
      const directive = titlesMap.get(originalTitle.toLowerCase());
      if (directive === undefined) {
        // Not listed at all in titles file — skip silently
        skipped++;
        continue;
      }
      if (directive === null) {
        // Explicitly commented out
        console.log(`  [${i + 1}/${entries.length}] SKIP (commented out): ${originalTitle}`);
        skipped++;
        continue;
      }
      storeTitle = directive;
    }

    const intervals = entry.intervals ?? [];
    if (intervals.length === 0) {
      console.log(`  [${i + 1}/${entries.length}] SKIP (no intervals): ${originalTitle}`);
      skipped++;
      continue;
    }

    // Dedup: same store title + same sequence already in DB → skip
    const dedupeKey = `${storeTitle.toLowerCase()}|${intervals.join(',')}`;
    if (existingKeys.has(dedupeKey)) {
      console.log(`  [${i + 1}/${entries.length}] SKIP (identical sequence exists): ${storeTitle}`);
      skipped++;
      continue;
    }

    const isKnownTitle = existingTitles.has(storeTitle.toLowerCase());
    const durationRatios = (entry.rhythm ?? []).map(v => Math.round(v * 16));

    try {
      await query(
        `INSERT INTO jazz_standards
           (id, title, composer, year, key, time_signature, interval_sequence, duration_ratios, book_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          randomUUID(),
          storeTitle,
          entry.composer ?? null,
          null,
          entry.key ?? null,
          entry.meter ?? '4/4',
          intervals,
          durationRatios.length > 0 ? durationRatios : null,
          bookSource,
        ]
      );

      const tag = isKnownTitle ? 'NEW SEQUENCE' : 'NEW TITLE   ';
      const aliasNote = storeTitle !== originalTitle ? ` (was: "${originalTitle}")` : '';
      console.log(`  [${i + 1}/${entries.length}] ${tag}: ${storeTitle}${aliasNote} (${intervals.length} intervals)`);
      inserted++;
    } catch (e) {
      console.error(`  [${i + 1}/${entries.length}] ERROR: ${storeTitle} — ${(e as Error).message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  if (errors > 0) console.log(`❌ Errors:   ${errors}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
