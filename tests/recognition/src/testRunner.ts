import axios from 'axios';
import { Pool } from 'pg';
import {
  TestConfig,
  JazzStandard,
  TestCase,
  TestResult,
  TestSummary,
  ErrorDetail,
  SearchResult,
} from './types';

export class RecognitionTestRunner {
  private config: TestConfig;
  private pool: Pool;

  constructor(config: TestConfig) {
    this.config = config;
    this.pool = new Pool({
      connectionString: config.databaseUrl,
    });
  }

  async runTests(): Promise<TestSummary> {
    const standards = await this.fetchStandards();
    const testCases = this.generateTestCases(standards);
    const results: TestResult[] = [];

    console.log(`\nRunning ${testCases.length} recognition tests...\n`);

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      if (this.config.verbose) {
        console.log(`[${i + 1}/${testCases.length}] Testing: ${testCase.standardTitle}`);
      }

      const result = await this.runSingleTest(testCase);
      results.push(result);

      if (this.config.verbose) {
        const status = result.topMatchCorrect ? '✓' : result.correctMatch ? '~' : '✗';
        console.log(`  ${status} Rank: ${result.correctMatchRank ?? 'N/A'}, Confidence: ${result.correctMatchConfidence?.toFixed(3) ?? 'N/A'}`);
      }
    }

    await this.pool.end();

    return this.generateSummary(results);
  }

  private async fetchStandards(): Promise<JazzStandard[]> {
    let query = `
      SELECT id, title, composer, interval_sequence
      FROM jazz_standards
      WHERE array_length(interval_sequence, 1) >= $1
    `;
    const params: (number | string | undefined)[] = [this.config.sequenceLength];
    let paramIndex = 2;

    // Filter by specific standard if provided
    if (this.config.standardFilter) {
      query += ` AND LOWER(title) LIKE LOWER($${paramIndex})`;
      params.push(`%${this.config.standardFilter}%`);
      paramIndex++;
    }

    query += ` ORDER BY title`;

    if (this.config.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(this.config.limit);
    }

    const result = await this.pool.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      composer: row.composer,
      intervalSequence: row.interval_sequence,
    }));
  }

  private generateTestCases(standards: JazzStandard[]): TestCase[] {
    return standards.map(standard => {
      const { sequence, startPosition } = this.extractSequence(standard.intervalSequence);
      const { modifiedSequence, errors } = this.applyErrors(sequence);

      return {
        standardId: standard.id,
        standardTitle: standard.title,
        originalSequence: standard.intervalSequence,
        testSequence: modifiedSequence,
        extractionStart: startPosition,
        errorsApplied: errors,
      };
    });
  }

  private extractSequence(intervals: number[]): { sequence: number[]; startPosition: number } {
    const maxStart = intervals.length - this.config.sequenceLength;
    let startPosition: number;

    switch (this.config.startPosition) {
      case 'beginning':
        startPosition = 0;
        break;
      case 'end':
        startPosition = maxStart;
        break;
      case 'middle':
        startPosition = Math.floor(maxStart / 2);
        break;
      case 'random':
      default:
        startPosition = Math.floor(Math.random() * (maxStart + 1));
        break;
    }

    return {
      sequence: intervals.slice(startPosition, startPosition + this.config.sequenceLength),
      startPosition,
    };
  }

  private applyErrors(sequence: number[]): { modifiedSequence: number[]; errors: ErrorDetail[] } {
    if (this.config.errorCount === 0) {
      return { modifiedSequence: [...sequence], errors: [] };
    }

    const modifiedSequence = [...sequence];
    const errors: ErrorDetail[] = [];
    const [minRange, maxRange] = this.config.errorRange;

    for (let i = 0; i < this.config.errorCount; i++) {
      const errorType = this.selectErrorType();
      const position = Math.floor(Math.random() * modifiedSequence.length);

      switch (errorType) {
        case 'add': {
          const newValue = this.randomInterval(minRange, maxRange);
          modifiedSequence.splice(position, 0, newValue);
          errors.push({ type: 'add', position, newValue });
          break;
        }
        case 'remove': {
          if (modifiedSequence.length > 2) {
            const originalValue = modifiedSequence[position];
            modifiedSequence.splice(position, 1);
            errors.push({ type: 'remove', position, originalValue });
          }
          break;
        }
        case 'modify': {
          const originalValue = modifiedSequence[position];
          const newValue = originalValue + this.randomInterval(-3, 3);
          modifiedSequence[position] = newValue;
          errors.push({ type: 'modify', position, originalValue, newValue });
          break;
        }
      }
    }

    return { modifiedSequence, errors };
  }

  private selectErrorType(): 'add' | 'remove' | 'modify' {
    if (this.config.errorType === 'both') {
      const types: ('add' | 'remove' | 'modify')[] = ['add', 'remove', 'modify'];
      return types[Math.floor(Math.random() * types.length)];
    }
    return this.config.errorType;
  }

  private randomInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private async runSingleTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const response = await axios.post<{
        success: boolean;
        data: Array<{
          standard: { id: string; title: string };
          confidence: number;
          matchPosition: number;
        }>;
        executionTimeMs: number;
      }>(`${this.config.searchServiceUrl}/search`, {
        intervals: testCase.testSequence,
      });

      const executionTimeMs = Date.now() - startTime;

      const searchResults: SearchResult[] = response.data.data.map(r => ({
        id: r.standard.id,
        title: r.standard.title,
        confidence: r.confidence,
        matchPosition: r.matchPosition,
      }));

      // Find if the correct standard is in the results
      const correctMatchIndex = searchResults.findIndex(r => r.id === testCase.standardId);
      const correctMatch = correctMatchIndex !== -1;
      const correctMatchRank = correctMatch ? correctMatchIndex + 1 : null;
      const correctMatchConfidence = correctMatch ? searchResults[correctMatchIndex].confidence : null;
      const topMatchCorrect = searchResults.length > 0 && searchResults[0].id === testCase.standardId;

      return {
        testCase,
        searchResults,
        correctMatch,
        correctMatchRank,
        correctMatchConfidence,
        topMatchCorrect,
        executionTimeMs,
      };
    } catch (error) {
      return {
        testCase,
        searchResults: [],
        correctMatch: false,
        correctMatchRank: null,
        correctMatchConfidence: null,
        topMatchCorrect: false,
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private generateSummary(results: TestResult[]): TestSummary {
    const successfulTests = results.filter(r => r.correctMatch).length;
    const topMatchCorrect = results.filter(r => r.topMatchCorrect).length;
    const noMatchCount = results.filter(r => r.searchResults.length === 0).length;

    const confidences = results
      .filter(r => r.correctMatchConfidence !== null)
      .map(r => r.correctMatchConfidence!);

    const ranks = results
      .filter(r => r.correctMatchRank !== null)
      .map(r => r.correctMatchRank!);

    const averageConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    const averageRank = ranks.length > 0
      ? ranks.reduce((a, b) => a + b, 0) / ranks.length
      : 0;

    const averageExecutionTime = results.reduce((a, r) => a + r.executionTimeMs, 0) / results.length;

    return {
      config: this.config,
      totalTests: results.length,
      successfulTests,
      topMatchCorrect,
      averageConfidence,
      averageRank,
      averageExecutionTime,
      noMatchCount,
      results,
      timestamp: new Date(),
    };
  }
}
