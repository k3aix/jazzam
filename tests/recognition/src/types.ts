// Test Configuration Types

export interface TestConfig {
  // Sequence extraction settings
  sequenceLength: number;           // Length of interval sequence to extract
  startPosition: 'beginning' | 'middle' | 'end' | 'random';  // Where to extract from

  // Error injection settings
  errorCount: number;               // Number of errors to inject (0 = no errors)
  errorType: 'add' | 'remove' | 'modify' | 'both';  // Type of errors
  errorRange: [number, number];     // Range for random interval errors (e.g., [-5, 5])

  // Test execution settings
  limit?: number;                   // Limit number of standards to test (undefined = all)
  standardFilter?: string;          // Filter by standard title (partial match)
  searchServiceUrl: string;         // URL of the search service
  databaseUrl: string;              // PostgreSQL connection string

  // Output settings
  outputFormat: 'console' | 'json' | 'html';
  outputFile?: string;              // File to write results to
  verbose: boolean;                 // Show detailed output
}

export interface JazzStandard {
  id: string;
  title: string;
  composer: string | null;
  intervalSequence: number[];
}

export interface TestCase {
  standardId: string;
  standardTitle: string;
  originalSequence: number[];
  testSequence: number[];
  extractionStart: number;
  errorsApplied: ErrorDetail[];
}

export interface ErrorDetail {
  type: 'add' | 'remove' | 'modify';
  position: number;
  originalValue?: number;
  newValue?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  confidence: number;
  matchPosition: number;
}

export interface TestResult {
  testCase: TestCase;
  searchResults: SearchResult[];
  correctMatch: boolean;           // Did the correct standard appear in results?
  correctMatchRank: number | null; // Position in results (1-based), null if not found
  correctMatchConfidence: number | null;
  topMatchCorrect: boolean;        // Is the top result the correct standard?
  executionTimeMs: number;
  error?: string;
}

export interface TestSummary {
  config: TestConfig;
  totalTests: number;
  successfulTests: number;         // Tests where correct standard was found
  topMatchCorrect: number;         // Tests where top result was correct
  averageConfidence: number;       // Average confidence when correct match found
  averageRank: number;             // Average rank when correct match found
  averageExecutionTime: number;
  noMatchCount: number;            // Tests with no results at all
  results: TestResult[];
  timestamp: Date;
}

export interface ConfidenceDistribution {
  range: string;  // e.g., "0.9-1.0", "0.8-0.9"
  count: number;
  percentage: number;
}

export interface RankDistribution {
  rank: number;   // 1, 2, 3, etc.
  count: number;
  percentage: number;
}
