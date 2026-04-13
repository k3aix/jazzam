import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { TuningTestCase } from './types';

/**
 * Parse search service log files and extract confirmed feedback entries.
 *
 * Two formats are supported:
 *
 * Format A — single line (production Docker, older logging):
 *   2026-03-26 19:50:58 [INF] FEEDBACK: confirmed="TITLE" (id=UUID) confidence=76.7 % intervals=[5, 2] ratios=[8, 4]
 *
 * Format B — multi-line (newer logging with context):
 *   2026-03-26 19:50:58 [INF] FEEDBACK [ctx]: confirmed="TITLE" (id=UUID) confidence=76.7%
 *   2026-03-26 19:50:58 [INF]   played:   intervals=[5, 2] ratios=[8, 4]
 *   2026-03-26 19:50:58 [INF]   db match: intervals=[5, 2] at note 0 (len 2)
 */
export function extractFromLogFile(logPath: string): TuningTestCase[] {
  const cases: TuningTestCase[] = [];
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.includes('FEEDBACK')) continue;

    const titleMatch = line.match(/confirmed="([^"]+)"/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // ── Format A: intervals and ratios on the same line ──────────────────
    const inlineIntervalsMatch = line.match(/intervals=\[([^\]]*)\]/);
    const inlineRatiosMatch = line.match(/ratios=\[([^\]]*)\]/);

    if (inlineIntervalsMatch) {
      const intervals = parseIntList(inlineIntervalsMatch[1]);
      const ratios = inlineRatiosMatch ? parseIntList(inlineRatiosMatch[1]) : [];

      if (intervals.length === 0) continue;
      if (isNoneCorrect(title)) continue;

      const id = makeHash(title, intervals);
      cases.push({
        id,
        title,
        intervals,
        ratios,
        source: `${path.basename(logPath)}:${i + 1}`,
        addedAt: new Date().toISOString(),
      });
      continue;
    }

    // ── Format B: look for "played:" within the next 4 lines ─────────────
    for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
      const playedMatch = lines[j].match(/played:\s+intervals=\[([^\]]*)\]\s+ratios=\[([^\]]*)\]/);
      if (!playedMatch) continue;

      const intervals = parseIntList(playedMatch[1]);
      const ratios = parseIntList(playedMatch[2]);

      if (intervals.length === 0) break;
      if (isNoneCorrect(title)) break;

      const id = makeHash(title, intervals);
      cases.push({
        id,
        title,
        intervals,
        ratios,
        source: `${path.basename(logPath)}:${i + 1}`,
        addedAt: new Date().toISOString(),
      });
      break;
    }
  }

  return cases;
}

function isNoneCorrect(title: string): boolean {
  return title.toUpperCase().startsWith('NONE_CORRECT');
}

function parseIntList(raw: string): number[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));
}

function makeHash(title: string, intervals: number[]): string {
  const input = `${title}|${intervals.join(',')}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
}

/**
 * Load existing test cases from test-cases.json.
 */
export function loadTestCases(filePath: string): TuningTestCase[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as TuningTestCase[];
}

/**
 * Merge extracted cases with existing ones (dedup by id).
 * Returns the merged array and how many new cases were added.
 */
export function mergeTestCases(
  existing: TuningTestCase[],
  extracted: TuningTestCase[]
): { cases: TuningTestCase[]; added: number } {
  const seen = new Set(existing.map(c => c.id));
  const toAdd: TuningTestCase[] = [];
  for (const c of extracted) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      toAdd.push(c);
    }
  }
  return {
    cases: [...existing, ...toAdd],
    added: toAdd.length,
  };
}

/**
 * Save test cases to test-cases.json.
 */
export function saveTestCases(filePath: string, cases: TuningTestCase[]): void {
  fs.writeFileSync(filePath, JSON.stringify(cases, null, 2) + '\n');
}
