#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { glob } from 'glob';
import { loadTestCases, saveTestCases, extractFromLogFile, mergeTestCases } from './extractor';
import { generateOATVariants } from './variants';
import { buildSearchService, runVariant } from './runner';
import { SearchAlgorithmConfig, VariantResult } from './types';

const TEST_CASES_FILE = path.resolve(__dirname, '../test-cases.json');
const BASELINE_FILE = path.resolve(__dirname, '../configs/baseline.json');
const RESULTS_DIR = path.resolve(__dirname, '../results');

const program = new Command();

program
  .name('tuning-sweep')
  .description('OAT parameter sweep for the Jazz Melody Finder search algorithm')
  .version('1.0.0');

// ── extract ──────────────────────────────────────────────────────────────────
program
  .command('extract')
  .description('Parse log files and add confirmed feedback cases to test-cases.json')
  .requiredOption('-l, --log <pattern>', 'Glob pattern for log files (e.g. "/logs/search-*.log")')
  .action(async (options: { log: string }) => {
    console.log(chalk.bold.blue('\n🎵 Tuning Sweep — Extract\n'));

    const logFiles = await glob(options.log, { absolute: true });
    if (logFiles.length === 0) {
      console.error(chalk.red(`No log files matched: ${options.log}`));
      process.exit(1);
    }

    console.log(`Found ${logFiles.length} log file(s):`);
    logFiles.forEach(f => console.log(`  ${f}`));

    let extracted = 0;
    let allExtracted = [];

    for (const logFile of logFiles) {
      const cases = extractFromLogFile(logFile);
      allExtracted.push(...cases);
      console.log(`  ${path.basename(logFile)}: ${cases.length} FEEDBACK entries`);
      extracted += cases.length;
    }

    const existing = loadTestCases(TEST_CASES_FILE);
    const { cases, added } = mergeTestCases(existing, allExtracted);

    saveTestCases(TEST_CASES_FILE, cases);

    console.log(chalk.green(`\n✓ ${added} new case(s) added (${extracted} parsed, ${existing.length} existed)`));
    console.log(`  Total cases in test-cases.json: ${cases.length}`);

    if (added > 0) {
      console.log('\nNew cases:');
      const newCases = cases.slice(existing.length);
      for (const c of newCases) {
        console.log(`  [${c.id}] "${c.title}" — ${c.intervals.length} intervals ${c.ratios.length ? `+ ${c.ratios.length} ratios` : '(pitch only)'}`);
      }
    }
  });

// ── list ─────────────────────────────────────────────────────────────────────
program
  .command('list')
  .description('Show all test cases in test-cases.json')
  .action(() => {
    const cases = loadTestCases(TEST_CASES_FILE);

    if (cases.length === 0) {
      console.log(chalk.yellow('No test cases yet. Run "extract" first.'));
      return;
    }

    console.log(chalk.bold.blue(`\n🎵 Tuning test cases (${cases.length} total)\n`));

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const ratioInfo = c.ratios.length > 0 ? ` + ratios[${c.ratios.length}]` : ' (pitch only)';
      console.log(
        `  ${String(i + 1).padStart(3)}. [${c.id}] ${chalk.cyan(c.title)}\n` +
        `        intervals[${c.intervals.length}]=[${c.intervals.join(',')}]${ratioInfo}\n` +
        `        added: ${c.addedAt.slice(0, 10)}  source: ${c.source}`
      );
    }
  });

// ── sweep ─────────────────────────────────────────────────────────────────────
program
  .command('sweep')
  .description('Run OAT parameter sweep against all test cases')
  .option('--no-build', 'Skip dotnet build step (assumes already built)')
  .option('--only <names>', 'Comma-separated list of variant names to run (default: all)')
  .option('--baseline-file <path>', 'Path to baseline config JSON', BASELINE_FILE)
  .option('-o, --output <file>', 'Save results JSON to this file (default: results/sweep-TIMESTAMP.json)')
  .action(async (options: {
    build: boolean;
    only?: string;
    baselineFile: string;
    output?: string;
  }) => {
    console.log(chalk.bold.blue('\n🎵 Tuning Sweep — OAT Parameter Sweep\n'));

    // Load test cases
    const testCases = loadTestCases(TEST_CASES_FILE);
    if (testCases.length === 0) {
      console.error(chalk.red('No test cases found. Run "extract" first.'));
      process.exit(1);
    }
    console.log(`Test cases: ${testCases.length}`);

    // Load baseline config
    if (!fs.existsSync(options.baselineFile)) {
      console.error(chalk.red(`Baseline file not found: ${options.baselineFile}`));
      process.exit(1);
    }
    const baseline = JSON.parse(fs.readFileSync(options.baselineFile, 'utf-8')) as SearchAlgorithmConfig;

    // Generate variants
    let variants = generateOATVariants(baseline);
    if (options.only) {
      const filter = new Set(options.only.split(',').map(s => s.trim()));
      variants = variants.filter(v => filter.has(v.name));
      if (variants.length === 0) {
        console.error(chalk.red(`No variants matched filter: ${options.only}`));
        process.exit(1);
      }
    }
    console.log(`Variants: ${variants.length}\n`);

    // Build once
    if (options.build !== false) {
      process.stdout.write('Building search service... ');
      try {
        await buildSearchService();
        console.log(chalk.green('done'));
      } catch (e) {
        console.log(chalk.red('failed'));
        console.error(e);
        process.exit(1);
      }
    }

    // Run each variant
    const allResults: VariantResult[] = [];

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      process.stdout.write(
        `[${String(i + 1).padStart(3)}/${variants.length}] ${v.name.padEnd(35)} `
      );

      try {
        const result = await runVariant(v, testCases);
        allResults.push(result);

        const t1 = result.top1Count;
        const found = result.foundCount;
        const total = result.totalCases;
        const label =
          t1 === total ? chalk.green(`#1:${t1}/${total}`) :
          t1 >= Math.floor(total * 0.8) ? chalk.yellow(`#1:${t1}/${total}`) :
          chalk.red(`#1:${t1}/${total}`);

        console.log(`${label}  found:${found}/${total}  (${result.durationMs}ms)`);
      } catch (e) {
        console.log(chalk.red('ERROR: ' + String(e)));
        allResults.push({
          variant: v,
          results: [],
          top1Count: 0,
          foundCount: 0,
          totalCases: testCases.length,
          durationMs: 0,
        });
      }
    }

    // Print summary table
    printSummaryTable(allResults, testCases.map(c => c.title));

    // Save results
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const outFile = options.output ?? path.join(RESULTS_DIR, `sweep-${timestamp()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
    console.log(chalk.dim(`\nResults saved to: ${outFile}`));
  });

// ── helpers ───────────────────────────────────────────────────────────────────

function printSummaryTable(results: VariantResult[], caseTitles: string[]): void {
  const shortTitles = caseTitles.map(t => t.slice(0, 18).padEnd(18));

  // Header
  const variantColW = 35;
  const header = 'Variant'.padEnd(variantColW) + '  T1   Found  ' + shortTitles.map(t => t.slice(0, 10).padEnd(11)).join('');
  console.log('\n' + chalk.bold(header));
  console.log('─'.repeat(header.length));

  // Find best top1 for highlighting
  const maxT1 = Math.max(...results.map(r => r.top1Count));

  for (const r of results) {
    const name = r.variant.name.padEnd(variantColW);
    const t1 = String(r.top1Count).padStart(2);
    const found = String(r.foundCount).padStart(2);
    const total = r.totalCases;
    const t1Cell = r.top1Count === maxT1 ? chalk.green(`${t1}/${total}`) : `${t1}/${total}`;
    const foundCell = `${found}/${total}`;

    const perCase = r.results.map(cr => {
      if (!cr.found) return chalk.red('miss'.padEnd(11));
      if (cr.rank === 1) return chalk.green(`#1`.padEnd(11));
      return chalk.yellow(`#${cr.rank}`.padEnd(11));
    }).join('');

    console.log(`${name}  ${t1Cell.padEnd(8)}${foundCell.padEnd(7)}${perCase}`);
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

program.parse(process.argv);
