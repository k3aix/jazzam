export interface JazzStandard {
  id: string;
  title: string;
  composer: string | null;
  year: number | null;
  key: string | null;
  time_signature: string;
  interval_sequence: number[];
  original_notes: string | null;
  book_source: string | null;
  page_number: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SearchResult {
  standard: JazzStandard;
  matchPosition: number;
  matchLength: number;
  confidence: number;
}

export interface SearchQuery {
  intervals: number[];
  minConfidence?: number;
}
