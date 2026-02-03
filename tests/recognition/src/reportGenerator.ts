import * as fs from 'fs';
import chalk from 'chalk';
import {
  TestSummary,
  TestResult,
  ConfidenceDistribution,
  RankDistribution,
} from './types';

export class ReportGenerator {
  private summary: TestSummary;

  constructor(summary: TestSummary) {
    this.summary = summary;
  }

  generateConsoleReport(): void {
    const { summary } = this;

    console.log('\n' + '='.repeat(70));
    console.log(chalk.bold.blue('  RECOGNITION TEST REPORT'));
    console.log('='.repeat(70) + '\n');

    // Configuration
    console.log(chalk.bold('Configuration:'));
    console.log(`  Sequence Length:    ${summary.config.sequenceLength}`);
    console.log(`  Start Position:     ${summary.config.startPosition}`);
    console.log(`  Errors Injected:    ${summary.config.errorCount}`);
    if (summary.config.errorCount > 0) {
      console.log(`  Error Type:         ${summary.config.errorType}`);
      console.log(`  Error Range:        [${summary.config.errorRange.join(', ')}]`);
    }
    console.log('');

    // Overall Results
    console.log(chalk.bold('Overall Results:'));
    console.log(`  Total Tests:        ${summary.totalTests}`);
    console.log(`  Successful:         ${this.formatSuccess(summary.successfulTests, summary.totalTests)}`);
    console.log(`  Top Match Correct:  ${this.formatSuccess(summary.topMatchCorrect, summary.totalTests)}`);
    console.log(`  No Match Found:     ${summary.noMatchCount} (${this.percentage(summary.noMatchCount, summary.totalTests)})`);
    console.log('');

    // Performance Metrics
    console.log(chalk.bold('Performance Metrics:'));
    console.log(`  Avg Confidence:     ${(summary.averageConfidence * 100).toFixed(1)}%`);
    console.log(`  Avg Rank:           ${summary.averageRank.toFixed(2)}`);
    console.log(`  Avg Execution Time: ${summary.averageExecutionTime.toFixed(0)}ms`);
    console.log('');

    // Confidence Distribution
    console.log(chalk.bold('Confidence Distribution:'));
    const confDist = this.calculateConfidenceDistribution();
    confDist.forEach(d => {
      const bar = '█'.repeat(Math.floor(d.percentage / 5));
      console.log(`  ${d.range}: ${bar} ${d.count} (${d.percentage.toFixed(1)}%)`);
    });
    console.log('');

    // Rank Distribution
    console.log(chalk.bold('Rank Distribution (when found):'));
    const rankDist = this.calculateRankDistribution();
    rankDist.slice(0, 5).forEach(d => {
      const bar = '█'.repeat(Math.floor(d.percentage / 5));
      console.log(`  #${d.rank}: ${bar} ${d.count} (${d.percentage.toFixed(1)}%)`);
    });
    console.log('');

    // Failed Tests
    const failedTests = summary.results.filter(r => !r.correctMatch);
    if (failedTests.length > 0) {
      console.log(chalk.bold.red(`Failed Tests (${failedTests.length}):`));
      failedTests.slice(0, 10).forEach(r => {
        console.log(`  ${chalk.red('✗')} ${r.testCase.standardTitle}`);
        console.log(`    Sequence: [${r.testCase.testSequence.join(', ')}]`);
        if (r.searchResults.length > 0) {
          console.log(`    Top result: "${r.searchResults[0].title}" (${(r.searchResults[0].confidence * 100).toFixed(1)}%)`);
        } else {
          console.log(`    No results returned`);
        }
        if (r.error) {
          console.log(`    Error: ${r.error}`);
        }
      });
      if (failedTests.length > 10) {
        console.log(`  ... and ${failedTests.length - 10} more`);
      }
      console.log('');
    }

    // Detailed Results Table
    console.log(chalk.bold('Detailed Results:'));
    console.log('-'.repeat(90));
    console.log(
      chalk.gray(
        `${'Title'.padEnd(30)} | ${'Rank'.padStart(4)} | ${'Conf'.padStart(6)} | ${'Errors'.padStart(6)} | ${'Top Match'.padEnd(25)}`
      )
    );
    console.log('-'.repeat(90));

    summary.results.forEach(r => {
      const title = r.testCase.standardTitle.substring(0, 28).padEnd(30);
      const rank = r.correctMatchRank?.toString().padStart(4) ?? 'N/A '.padStart(4);
      const conf = r.correctMatchConfidence
        ? `${(r.correctMatchConfidence * 100).toFixed(1)}%`.padStart(6)
        : 'N/A'.padStart(6);
      const errors = r.testCase.errorsApplied.length.toString().padStart(6);
      const topMatch = r.searchResults[0]?.title.substring(0, 23).padEnd(25) ?? 'None'.padEnd(25);

      const statusIcon = r.topMatchCorrect
        ? chalk.green('✓')
        : r.correctMatch
        ? chalk.yellow('~')
        : chalk.red('✗');

      console.log(`${statusIcon} ${title} | ${rank} | ${conf} | ${errors} | ${topMatch}`);
    });
    console.log('-'.repeat(90));

    // Legend
    console.log(chalk.gray('\nLegend: ✓ = Top match correct, ~ = Found but not top, ✗ = Not found'));

    console.log('\n' + '='.repeat(70) + '\n');
  }

  generateJsonReport(): string {
    return JSON.stringify(this.summary, null, 2);
  }

  generateHtmlReport(): string {
    const { summary } = this;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recognition Test Report - ${summary.timestamp.toISOString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1a365d; margin-bottom: 20px; }
    h2 { color: #2d3748; margin: 20px 0 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat { text-align: center; padding: 15px; background: #f7fafc; border-radius: 8px; }
    .stat-value { font-size: 2em; font-weight: bold; color: #2b6cb0; }
    .stat-label { color: #718096; font-size: 0.9em; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f7fafc; font-weight: 600; }
    tr:hover { background: #f7fafc; }
    .success { color: #38a169; }
    .warning { color: #d69e2e; }
    .error { color: #e53e3e; }
    .bar { background: #4299e1; height: 20px; border-radius: 4px; }
    .bar-container { background: #e2e8f0; border-radius: 4px; width: 100px; display: inline-block; }
    .config-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .config-item { display: flex; justify-content: space-between; padding: 5px 0; }
    .config-label { color: #718096; }
    .config-value { font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Recognition Test Report</h1>
    <p style="color: #718096; margin-bottom: 20px;">Generated: ${summary.timestamp.toLocaleString()}</p>

    <div class="card">
      <h2>Configuration</h2>
      <div class="config-grid">
        <div class="config-item"><span class="config-label">Sequence Length:</span><span class="config-value">${summary.config.sequenceLength}</span></div>
        <div class="config-item"><span class="config-label">Start Position:</span><span class="config-value">${summary.config.startPosition}</span></div>
        <div class="config-item"><span class="config-label">Errors Injected:</span><span class="config-value">${summary.config.errorCount}</span></div>
        <div class="config-item"><span class="config-label">Error Type:</span><span class="config-value">${summary.config.errorType}</span></div>
      </div>
    </div>

    <div class="card">
      <h2>Summary</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${summary.totalTests}</div>
          <div class="stat-label">Total Tests</div>
        </div>
        <div class="stat">
          <div class="stat-value success">${((summary.successfulTests / summary.totalTests) * 100).toFixed(1)}%</div>
          <div class="stat-label">Success Rate</div>
        </div>
        <div class="stat">
          <div class="stat-value">${((summary.topMatchCorrect / summary.totalTests) * 100).toFixed(1)}%</div>
          <div class="stat-label">Top Match Correct</div>
        </div>
        <div class="stat">
          <div class="stat-value">${(summary.averageConfidence * 100).toFixed(1)}%</div>
          <div class="stat-label">Avg Confidence</div>
        </div>
        <div class="stat">
          <div class="stat-value">${summary.averageRank.toFixed(2)}</div>
          <div class="stat-label">Avg Rank</div>
        </div>
        <div class="stat">
          <div class="stat-value">${summary.averageExecutionTime.toFixed(0)}ms</div>
          <div class="stat-label">Avg Execution Time</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Confidence Distribution</h2>
      ${this.generateHtmlConfidenceChart()}
    </div>

    <div class="card">
      <h2>Detailed Results</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Title</th>
            <th>Rank</th>
            <th>Confidence</th>
            <th>Errors</th>
            <th>Top Match</th>
          </tr>
        </thead>
        <tbody>
          ${summary.results.map(r => `
            <tr>
              <td>${r.topMatchCorrect ? '<span class="success">✓</span>' : r.correctMatch ? '<span class="warning">~</span>' : '<span class="error">✗</span>'}</td>
              <td>${r.testCase.standardTitle}</td>
              <td>${r.correctMatchRank ?? 'N/A'}</td>
              <td>${r.correctMatchConfidence ? (r.correctMatchConfidence * 100).toFixed(1) + '%' : 'N/A'}</td>
              <td>${r.testCase.errorsApplied.length}</td>
              <td>${r.searchResults[0]?.title ?? 'None'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  }

  saveReport(format: 'json' | 'html', filepath: string): void {
    const content = format === 'json' ? this.generateJsonReport() : this.generateHtmlReport();
    fs.writeFileSync(filepath, content);
    console.log(chalk.green(`Report saved to: ${filepath}`));
  }

  private formatSuccess(count: number, total: number): string {
    const pct = (count / total) * 100;
    const color = pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
    return color(`${count}/${total} (${pct.toFixed(1)}%)`);
  }

  private percentage(count: number, total: number): string {
    return `${((count / total) * 100).toFixed(1)}%`;
  }

  private calculateConfidenceDistribution(): ConfidenceDistribution[] {
    const ranges = [
      { range: '90-100%', min: 0.9, max: 1.0 },
      { range: '80-90%', min: 0.8, max: 0.9 },
      { range: '70-80%', min: 0.7, max: 0.8 },
      { range: '60-70%', min: 0.6, max: 0.7 },
      { range: '50-60%', min: 0.5, max: 0.6 },
      { range: '<50%', min: 0, max: 0.5 },
    ];

    const confidences = this.summary.results
      .filter(r => r.correctMatchConfidence !== null)
      .map(r => r.correctMatchConfidence!);

    const total = confidences.length || 1;

    return ranges.map(({ range, min, max }) => {
      const count = confidences.filter(c => c >= min && c < max).length;
      return { range, count, percentage: (count / total) * 100 };
    });
  }

  private calculateRankDistribution(): RankDistribution[] {
    const ranks = this.summary.results
      .filter(r => r.correctMatchRank !== null)
      .map(r => r.correctMatchRank!);

    const total = ranks.length || 1;
    const distribution: Map<number, number> = new Map();

    ranks.forEach(rank => {
      distribution.set(rank, (distribution.get(rank) || 0) + 1);
    });

    return Array.from(distribution.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rank, count]) => ({
        rank,
        count,
        percentage: (count / total) * 100,
      }));
  }

  private generateHtmlConfidenceChart(): string {
    const dist = this.calculateConfidenceDistribution();
    return `<div style="margin-top: 10px;">
      ${dist.map(d => `
        <div style="display: flex; align-items: center; margin: 5px 0;">
          <span style="width: 80px;">${d.range}</span>
          <div class="bar-container">
            <div class="bar" style="width: ${d.percentage}%;"></div>
          </div>
          <span style="margin-left: 10px; color: #718096;">${d.count} (${d.percentage.toFixed(1)}%)</span>
        </div>
      `).join('')}
    </div>`;
  }
}
