#!/usr/bin/env ts-node

import { Command } from 'commander';
import chalk from 'chalk';
import { TestConfig } from './types';
import { RecognitionTestRunner } from './testRunner';
import { ReportGenerator } from './reportGenerator';

const program = new Command();

program
  .name('recognition-test')
  .description('Automated recognition tests for Jazz Melody Finder')
  .version('1.0.0')
  .option('-l, --length <number>', 'Length of interval sequence to test', '8')
  .option('-p, --position <type>', 'Position to extract from (beginning|middle|end|random)', 'random')
  .option('-e, --errors <number>', 'Number of errors to inject', '0')
  .option('-t, --error-type <type>', 'Type of errors (add|remove|modify|both)', 'both')
  .option('-r, --error-range <range>', 'Range for random intervals, e.g., "-5,5"', '-5,5')
  .option('--limit <number>', 'Limit number of standards to test')
  .option('-o, --output <format>', 'Output format (console|json|html)', 'console')
  .option('-f, --file <path>', 'Output file path')
  .option('-v, --verbose', 'Show detailed output during test run')
  .option('-s, --standard <name>', 'Test only a specific standard (partial match on title)')
  .option('--search-url <url>', 'Search service URL', 'http://localhost:5001/api')
  .option('--db-url <url>', 'Database connection URL', 'postgresql://jazzuser:jazzpass123@localhost:5432/jazz_standards')
  .action(async (options) => {
    console.log(chalk.bold.blue('\n🎵 Jazz Melody Finder - Recognition Test Suite\n'));

    // Parse error range
    const errorRange = options.errorRange.split(',').map(Number) as [number, number];

    const config: TestConfig = {
      sequenceLength: parseInt(options.length),
      startPosition: options.position as 'beginning' | 'middle' | 'end' | 'random',
      errorCount: parseInt(options.errors),
      errorType: options.errorType as 'add' | 'remove' | 'modify' | 'both',
      errorRange,
      limit: options.limit ? parseInt(options.limit) : undefined,
      standardFilter: options.standard,
      searchServiceUrl: options.searchUrl,
      databaseUrl: options.dbUrl,
      outputFormat: options.output as 'console' | 'json' | 'html',
      outputFile: options.file,
      verbose: options.verbose || false,
    };

    // Validate configuration
    if (config.sequenceLength < 2) {
      console.error(chalk.red('Error: Sequence length must be at least 2'));
      process.exit(1);
    }

    if (config.errorCount < 0) {
      console.error(chalk.red('Error: Error count cannot be negative'));
      process.exit(1);
    }

    // Display configuration
    console.log(chalk.gray('Configuration:'));
    console.log(chalk.gray(`  Sequence Length: ${config.sequenceLength}`));
    console.log(chalk.gray(`  Start Position:  ${config.startPosition}`));
    console.log(chalk.gray(`  Errors:          ${config.errorCount} (${config.errorType})`));
    if (config.standardFilter) {
      console.log(chalk.gray(`  Standard:        "${config.standardFilter}"`));
    }
    if (config.limit) {
      console.log(chalk.gray(`  Limit:           ${config.limit} standards`));
    }
    console.log(chalk.gray(`  Search Service:  ${config.searchServiceUrl}`));
    console.log('');

    try {
      // Run tests
      const runner = new RecognitionTestRunner(config);
      const summary = await runner.runTests();

      // Generate report
      const reporter = new ReportGenerator(summary);

      if (config.outputFormat === 'console') {
        reporter.generateConsoleReport();
      }

      if (config.outputFile) {
        const format = config.outputFormat === 'console' ? 'json' : config.outputFormat;
        reporter.saveReport(format as 'json' | 'html', config.outputFile);
      }

      // Exit with appropriate code
      const successRate = summary.successfulTests / summary.totalTests;
      process.exit(successRate >= 0.8 ? 0 : 1);
    } catch (error) {
      console.error(chalk.red('\nError running tests:'));
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Parse arguments and run
program.parse();
