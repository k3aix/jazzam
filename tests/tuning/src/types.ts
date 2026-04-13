export interface TuningTestCase {
  /** SHA-256 hash (first 12 chars) of "title|intervals" — stable dedup key */
  id: string;
  /** Confirmed song title as logged */
  title: string;
  /** Intervals the user played */
  intervals: number[];
  /** Duration ratios the user played (empty = pitch-only search) */
  ratios: number[];
  /** Log file path + line number for traceability */
  source: string;
  /** ISO timestamp when this case was extracted */
  addedAt: string;
}

export interface EnhancedScoringConfig {
  Enabled: boolean;
  ConsecutiveMissThreshold: number;
  ConsecutiveMissPenalty: number;
}

export interface CorrectionDetectionConfig {
  Enabled: boolean;
  MaxWidth: number;
  MaxDuration: number;
  MaxSequenceLength: number;
  MaxCorrectionRate: number;
}

export interface CompressedSearchConfig {
  Enabled: boolean;
  ConfidencePenalty: number;
  MinRunLength: number;
}

export interface SearchAlgorithmConfig {
  MinimumIntervals: number;
  DefaultErrorTolerance: number;
  DefaultMinConfidence: number;
  EnablePositionBias: boolean;
  DefaultPitchWeight: number;
  RhythmErrorTolerance: number;
  EnhancedScoring: EnhancedScoringConfig;
  CorrectionDetection: CorrectionDetectionConfig;
  CompressedSearch: CompressedSearchConfig;
}

export interface ConfigVariant {
  name: string;
  description: string;
  config: SearchAlgorithmConfig;
}

export interface CaseResult {
  testCase: TuningTestCase;
  /** 1-based rank of the expected title, or null if not found */
  rank: number | null;
  confidence: number | null;
  found: boolean;
  useRhythm: boolean;
}

export interface VariantResult {
  variant: ConfigVariant;
  results: CaseResult[];
  /** Cases where rank === 1 */
  top1Count: number;
  /** Cases where found (any rank) */
  foundCount: number;
  totalCases: number;
  durationMs: number;
}

export interface SearchApiResult {
  id: string;
  title: string;
  confidence: number;
}

export interface SearchApiResponse {
  success: boolean;
  count: number;
  data: Array<{ standard: { id: string; title: string }; confidence: number }>;
  error?: string;
}
