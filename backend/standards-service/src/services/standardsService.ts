import { query } from '../config/db';
import { JazzStandard, SearchResult, SearchQuery } from '../models/JazzStandard';

export class StandardsService {
  /**
   * Get all jazz standards from the database
   */
  async getAllStandards(): Promise<JazzStandard[]> {
    const result = await query('SELECT * FROM jazz_standards ORDER BY title');
    return result.rows;
  }

  /**
   * Get a single standard by ID
   */
  async getStandardById(id: string): Promise<JazzStandard | null> {
    const result = await query('SELECT * FROM jazz_standards WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Search for standards by interval sequence using subsequence matching
   */
  async searchByIntervals(searchQuery: SearchQuery): Promise<SearchResult[]> {
    const { intervals, minConfidence = 0.6 } = searchQuery;

    if (!intervals || intervals.length < 2) {
      throw new Error('Search query must contain at least 2 intervals');
    }

    // Get all standards from database
    const allStandards = await this.getAllStandards();
    const results: SearchResult[] = [];

    // For each standard, try to find the query sequence as a subsequence
    for (const standard of allStandards) {
      const match = this.findSubsequence(standard.interval_sequence, intervals);

      if (match) {
        const confidence = this.calculateConfidence(
          match.matchLength,
          intervals.length,
          standard.interval_sequence.length
        );

        if (confidence >= minConfidence) {
          results.push({
            standard,
            matchPosition: match.position,
            matchLength: match.matchLength,
            confidence,
          });
        }
      }
    }

    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * Find a subsequence within a larger sequence
   * Returns the position and length of the match, or null if not found
   */
  private findSubsequence(
    haystack: number[],
    needle: number[]
  ): { position: number; matchLength: number } | null {
    if (needle.length > haystack.length) {
      return null;
    }

    // Try to find exact match first
    for (let i = 0; i <= haystack.length - needle.length; i++) {
      let matches = true;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return { position: i, matchLength: needle.length };
      }
    }

    // If no exact match, try fuzzy matching (allow 1 difference)
    for (let i = 0; i <= haystack.length - needle.length; i++) {
      let differences = 0;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) {
          differences++;
          if (differences > 1) break;
        }
      }
      if (differences <= 1) {
        return { position: i, matchLength: needle.length };
      }
    }

    return null;
  }

  /**
   * Calculate confidence score based on match quality
   */
  private calculateConfidence(
    matchLength: number,
    queryLength: number,
    standardLength: number
  ): number {
    // Perfect match of entire query = 1.0
    const matchRatio = matchLength / queryLength;

    // Bonus for matching a significant portion of the standard
    const coverageBonus = Math.min(matchLength / standardLength, 0.2);

    const confidence = Math.min(matchRatio + coverageBonus, 1.0);

    return Math.round(confidence * 100) / 100; // Round to 2 decimals
  }
}
