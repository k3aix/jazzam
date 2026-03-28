// Type definitions for Jazz Melody Finder

/**
 * Represents a musical note with scientific pitch notation
 */
export interface Note {
  name: string;          // Scientific notation (e.g., "C4", "D#4", "Bb5")
  frequency: number;     // Hz (e.g., 440 for A4)
  timestamp: number;     // When the note was played (ms since start)
  octave: number;        // Octave number (e.g., 4 for middle C)
  pitchClass: string;    // Note without octave (e.g., "C", "D#", "Bb")
}

/**
 * Piano key information
 */
export interface PianoKey {
  note: string;          // Note name (e.g., "C4")
  frequency: number;     // Frequency in Hz
  type: 'white' | 'black';
  midiNumber: number;    // MIDI note number (60 = C4)
}

/**
 * Represents an interval sequence (melody as semitone differences)
 */
export interface IntervalSequence {
  intervals: number[];   // Array of semitone differences [2, 2, 1, -2, ...]
  noteCount: number;     // Number of notes in the original melody
  duration: number;      // Total duration in ms
}

/**
 * Search result for a jazz standard match
 */
export interface SearchResult {
  id: string;
  title: string;
  composer: string;
  year?: number;
  key?: string;
  timeSignature?: string;
  matchConfidence: number;      // 0-1 confidence score
  matchPosition: number;        // Position in song where match starts (note index)
  matchLength: number;          // Number of intervals matched
  intervalSequence: number[];   // Full interval sequence of the standard
  bookSource?: string;          // Which Real Book
  pageNumber?: number;
  pitchConfidence?: number;     // 0-1 pitch-only confidence (rhythm search)
  rhythmConfidence?: number;    // 0-1 rhythm-only confidence (rhythm search)
}

/**
 * API request to search for standards
 */
export interface SearchRequest {
  intervals: number[];
  tolerance?: number;    // 0 = exact match, 1+ = allow fuzzy matching
  maxResults?: number;   // Maximum number of results to return
}

/**
 * API request for rhythm-aware search
 */
export interface RhythmSearchRequest {
  intervals: number[];
  durationRatios: number[];
  pitchWeight?: number;   // 0-1, default 0.6
  minConfidence?: number;
  maxResults?: number;
  errorTolerance?: number;
}

/**
 * API response from search endpoint
 */
export interface SearchResponse {
  results: SearchResult[];
  queryTime: number;     // Query execution time in ms
  totalMatches: number;
}

/**
 * Represents the current state of played notes
 */
export interface MelodyState {
  notes: Note[];
  intervals: number[];
  isRecording: boolean;
  startTime: number;
}
