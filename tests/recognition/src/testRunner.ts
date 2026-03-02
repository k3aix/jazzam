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
        const pStatus = result.topMatchCorrect ? '✓' : result.correctMatch ? '~' : '✗';
        const pInfo = `Pitch: ${pStatus} Rank ${result.correctMatchRank ?? 'N/A'}, Conf ${result.correctMatchConfidence?.toFixed(3) ?? 'N/A'}`;

        let rInfo = '';
        if (testCase.durationRatios) {
          const rStatus = result.rhythmTopMatchCorrect ? '✓' : result.rhythmCorrectMatch ? '~' : '✗';
          rInfo = ` | Rhythm: ${rStatus} Rank ${result.rhythmCorrectMatchRank ?? 'N/A'}, Conf ${result.rhythmCorrectMatchConfidence?.toFixed(3) ?? 'N/A'}`;
        }
        console.log(`  ${pInfo}${rInfo}`);
      }
    }

    await this.pool.end();

    return this.generateSummary(results);
  }

  private async fetchStandards(): Promise<JazzStandard[]> {
    let query = `
      SELECT id, title, composer, interval_sequence, duration_ratios
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
      durationRatios: row.duration_ratios ?? null,
    }));
  }

  private generateTestCases(standards: JazzStandard[]): TestCase[] {
    return standards.map(standard => {
      const { sequence, startPosition } = this.extractSequence(standard.intervalSequence);
      const { modifiedSequence, errors } = this.applyErrors(sequence);

      // Extract matching duration ratios segment (same position, same length)
      let durationRatios: number[] | null = null;
      if (standard.durationRatios && standard.durationRatios.length >= startPosition + this.config.sequenceLength) {
        // Duration ratios has same length as intervals (N-1 for N notes)
        // so the positions match directly
        durationRatios = standard.durationRatios.slice(startPosition, startPosition + this.config.sequenceLength);
      }

      return {
        standardId: standard.id,
        standardTitle: standard.title,
        originalSequence: standard.intervalSequence,
        testSequence: modifiedSequence,
        durationRatios,
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
    // Fire pitch-only and rhythm searches in parallel
    const pitchPromise = this.runPitchSearch(testCase);
    const rhythmPromise = testCase.durationRatios
      ? this.runRhythmSearch(testCase)
      : Promise.resolve(null);

    const [pitchResult, rhythmResult] = await Promise.all([pitchPromise, rhythmPromise]);

    return {
      ...pitchResult,
      ...(rhythmResult ?? {
        rhythmSearchResults: [],
        rhythmCorrectMatch: false,
        rhythmCorrectMatchRank: null,
        rhythmCorrectMatchConfidence: null,
        rhythmTopMatchCorrect: false,
        rhythmExecutionTimeMs: 0,
      }),
    };
  }

  private async runPitchSearch(testCase: TestCase): Promise<Omit<TestResult, 'rhythmSearchResults' | 'rhythmCorrectMatch' | 'rhythmCorrectMatchRank' | 'rhythmCorrectMatchConfidence' | 'rhythmTopMatchCorrect' | 'rhythmExecutionTimeMs' | 'rhythmError'>> {
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

      const correctMatchIndex = searchResults.findIndex(r => r.id === testCase.standardId);
      const correctMatch = correctMatchIndex !== -1;

      return {
        testCase,
        searchResults,
        correctMatch,
        correctMatchRank: correctMatch ? correctMatchIndex + 1 : null,
        correctMatchConfidence: correctMatch ? searchResults[correctMatchIndex].confidence : null,
        topMatchCorrect: searchResults.length > 0 && searchResults[0].id === testCase.standardId,
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

  private async runRhythmSearch(testCase: TestCase): Promise<{
    rhythmSearchResults: SearchResult[];
    rhythmCorrectMatch: boolean;
    rhythmCorrectMatchRank: number | null;
    rhythmCorrectMatchConfidence: number | null;
    rhythmTopMatchCorrect: boolean;
    rhythmExecutionTimeMs: number;
    rhythmError?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await axios.post<{
        success: boolean;
        data: Array<{
          standard: { id: string; title: string };
          confidence: number;
          matchPosition: number;
          pitchConfidence?: number;
          rhythmConfidence?: number;
        }>;
        executionTimeMs: number;
      }>(`${this.config.searchServiceUrl}/search/rhythm`, {
        intervals: testCase.testSequence,
        durationRatios: testCase.durationRatios,
      });

      const executionTimeMs = Date.now() - startTime;

      const searchResults: SearchResult[] = response.data.data.map(r => ({
        id: r.standard.id,
        title: r.standard.title,
        confidence: r.confidence,
        matchPosition: r.matchPosition,
        pitchConfidence: r.pitchConfidence,
        rhythmConfidence: r.rhythmConfidence,
      }));

      const correctMatchIndex = searchResults.findIndex(r => r.id === testCase.standardId);
      const correctMatch = correctMatchIndex !== -1;

      return {
        rhythmSearchResults: searchResults,
        rhythmCorrectMatch: correctMatch,
        rhythmCorrectMatchRank: correctMatch ? correctMatchIndex + 1 : null,
        rhythmCorrectMatchConfidence: correctMatch ? searchResults[correctMatchIndex].confidence : null,
        rhythmTopMatchCorrect: searchResults.length > 0 && searchResults[0].id === testCase.standardId,
        rhythmExecutionTimeMs: executionTimeMs,
      };
    } catch (error) {
      return {
        rhythmSearchResults: [],
        rhythmCorrectMatch: false,
        rhythmCorrectMatchRank: null,
        rhythmCorrectMatchConfidence: null,
        rhythmTopMatchCorrect: false,
        rhythmExecutionTimeMs: Date.now() - startTime,
        rhythmError: error instanceof Error ? error.message : 'Unknown error',
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

    // Rhythm stats (only for tests that had duration_ratios)
    const rhythmResults = results.filter(r => r.testCase.durationRatios !== null);
    const rhythmTestCount = rhythmResults.length;
    const rhythmSuccessfulTests = rhythmResults.filter(r => r.rhythmCorrectMatch).length;
    const rhythmTopMatchCorrect = rhythmResults.filter(r => r.rhythmTopMatchCorrect).length;
    const rhythmNoMatchCount = rhythmResults.filter(r => r.rhythmSearchResults.length === 0).length;

    const rhythmConfidences = rhythmResults
      .filter(r => r.rhythmCorrectMatchConfidence !== null)
      .map(r => r.rhythmCorrectMatchConfidence!);

    const rhythmRanks = rhythmResults
      .filter(r => r.rhythmCorrectMatchRank !== null)
      .map(r => r.rhythmCorrectMatchRank!);

    const rhythmAverageConfidence = rhythmConfidences.length > 0
      ? rhythmConfidences.reduce((a, b) => a + b, 0) / rhythmConfidences.length
      : 0;

    const rhythmAverageRank = rhythmRanks.length > 0
      ? rhythmRanks.reduce((a, b) => a + b, 0) / rhythmRanks.length
      : 0;

    const rhythmAverageExecutionTime = rhythmResults.length > 0
      ? rhythmResults.reduce((a, r) => a + r.rhythmExecutionTimeMs, 0) / rhythmResults.length
      : 0;

    return {
      config: this.config,
      totalTests: results.length,
      successfulTests,
      topMatchCorrect,
      averageConfidence,
      averageRank,
      averageExecutionTime,
      noMatchCount,
      rhythmSuccessfulTests,
      rhythmTopMatchCorrect,
      rhythmAverageConfidence,
      rhythmAverageRank,
      rhythmAverageExecutionTime,
      rhythmNoMatchCount,
      rhythmTestCount,
      results,
      timestamp: new Date(),
    };
  }
}
