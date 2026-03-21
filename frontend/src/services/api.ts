import axios from 'axios';
import { SearchRequest, RhythmSearchRequest, SearchResponse, SearchResult } from '../types';

// Microservices URLs
const SEARCH_SERVICE_URL = import.meta.env.VITE_SEARCH_SERVICE_URL || 'http://localhost:5001/api';
const STANDARDS_SERVICE_URL = import.meta.env.VITE_STANDARDS_SERVICE_URL || 'http://localhost:3001/api';

// Backend API response types (C# Search Service)
interface BackendSearchResult {
  standard: {
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
  };
  matchPosition: number;
  matchLength: number;
  confidence: number;
  pitchConfidence?: number | null;
  rhythmConfidence?: number | null;
}

interface BackendSearchResponse {
  success: boolean;
  count: number;
  executionTimeMs: number;
  data: BackendSearchResult[];
  error?: string | null;
}

class ApiService {

  /**
   * Search for jazz standards by interval sequence
   * Uses C# Search Service microservice
   */
  async searchByIntervals(request: SearchRequest): Promise<SearchResponse> {
    try {
      const response = await axios.post<BackendSearchResponse>(
        `${SEARCH_SERVICE_URL}/search`,
        { intervals: request.intervals }
      );

      // Transform backend response to frontend format
      const results: SearchResult[] = response.data.data.map((item) => ({
        id: item.standard.id,
        title: item.standard.title,
        composer: item.standard.composer || 'Unknown',
        year: item.standard.year || undefined,
        key: item.standard.key || undefined,
        timeSignature: item.standard.time_signature,
        matchConfidence: item.confidence,
        matchPosition: item.matchPosition,
        intervalSequence: item.standard.interval_sequence,
        bookSource: item.standard.book_source || undefined,
        pageNumber: item.standard.page_number || undefined,
      }));

      return {
        results,
        queryTime: response.data.executionTimeMs,
        totalMatches: response.data.count,
      };
    } catch (error) {
      // 400 = "not enough notes yet", return empty results instead of throwing
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        return { results: [], queryTime: 0, totalMatches: 0 };
      }
      console.error('Error searching standards:', error);
      throw error;
    }
  }

  /**
   * Search for jazz standards by interval sequence + rhythm (duration ratios)
   * Uses C# Search Service microservice
   */
  async searchByRhythm(request: RhythmSearchRequest): Promise<SearchResponse> {
    try {
      const response = await axios.post<BackendSearchResponse>(
        `${SEARCH_SERVICE_URL}/search/rhythm`,
        {
          intervals: request.intervals,
          durationRatios: request.durationRatios,
          pitchWeight: request.pitchWeight ?? 0.6,
          minConfidence: request.minConfidence ?? 0.4,
          maxResults: request.maxResults ?? 10,
          errorTolerance: request.errorTolerance ?? 0.3,
        }
      );

      const results: SearchResult[] = response.data.data.map((item) => ({
        id: item.standard.id,
        title: item.standard.title,
        composer: item.standard.composer || 'Unknown',
        year: item.standard.year || undefined,
        key: item.standard.key || undefined,
        timeSignature: item.standard.time_signature,
        matchConfidence: item.confidence,
        matchPosition: item.matchPosition,
        intervalSequence: item.standard.interval_sequence,
        bookSource: item.standard.book_source || undefined,
        pageNumber: item.standard.page_number || undefined,
        pitchConfidence: item.pitchConfidence ?? undefined,
        rhythmConfidence: item.rhythmConfidence ?? undefined,
      }));

      return {
        results,
        queryTime: response.data.executionTimeMs,
        totalMatches: response.data.count,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        return { results: [], queryTime: 0, totalMatches: 0 };
      }
      console.error('Error searching standards with rhythm:', error);
      throw error;
    }
  }

  /**
   * Get all jazz standards (paginated)
   * Uses Standards Service directly
   */
  async getAllStandards(page = 1, limit = 20): Promise<SearchResult[]> {
    try {
      const response = await axios.get<{ success: boolean; data: any[] }>(
        `${STANDARDS_SERVICE_URL}/standards`,
        { params: { page, limit } }
      );

      return response.data.data.map((standard) => ({
        id: standard.id,
        title: standard.title,
        composer: standard.composer || 'Unknown',
        year: standard.year || undefined,
        key: standard.key || undefined,
        timeSignature: standard.time_signature,
        matchConfidence: 1.0,
        matchPosition: 0,
        intervalSequence: standard.interval_sequence,
        bookSource: standard.book_source || undefined,
        pageNumber: standard.page_number || undefined,
      }));
    } catch (error) {
      console.error('Error fetching standards:', error);
      throw error;
    }
  }

  /**
   * Get a single standard by ID
   * Uses Standards Service directly
   */
  async getStandardById(id: string): Promise<SearchResult | null> {
    try {
      const response = await axios.get<{ success: boolean; data: any }>(
        `${STANDARDS_SERVICE_URL}/standards/${id}`
      );

      const standard = response.data.data;
      return {
        id: standard.id,
        title: standard.title,
        composer: standard.composer || 'Unknown',
        year: standard.year || undefined,
        key: standard.key || undefined,
        timeSignature: standard.time_signature,
        matchConfidence: 1.0,
        matchPosition: 0,
        intervalSequence: standard.interval_sequence,
        bookSource: standard.book_source || undefined,
        pageNumber: standard.page_number || undefined,
      };
    } catch (error) {
      console.error('Error fetching standard:', error);
      return null;
    }
  }
}

export const apiService = new ApiService();
export default apiService;
