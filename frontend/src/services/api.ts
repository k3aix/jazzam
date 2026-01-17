import axios from 'axios';
import { SearchRequest, SearchResponse, SearchResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Mock data for development before backend is ready
const MOCK_STANDARDS: SearchResult[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Blue Horizon',
    composer: 'Miles Mock',
    year: 1959,
    key: 'C',
    timeSignature: '4/4',
    matchConfidence: 0.95,
    matchPosition: 0,
    intervalSequence: [2, 2, 1, 2, 2, 2, 1],
    bookSource: 'Mock Real Book Vol 1',
    pageNumber: 42,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    title: 'Sunset Boulevard',
    composer: 'John Mock',
    year: 1963,
    key: 'Dm',
    timeSignature: '4/4',
    matchConfidence: 0.88,
    matchPosition: 2,
    intervalSequence: [2, 1, 2, 2, 1, 2, 2],
    bookSource: 'Mock Real Book Vol 3',
    pageNumber: 105,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    title: 'Midnight Train',
    composer: 'Charlie Mock',
    year: 1952,
    key: 'F',
    timeSignature: '4/4',
    matchConfidence: 0.72,
    matchPosition: 0,
    intervalSequence: [4, -3, 2, 5, -7, 3, -2],
    bookSource: 'Mock Real Book Vol 2',
    pageNumber: 78,
  },
];

class ApiService {
  private useMockData = true; // Toggle this when backend is ready

  /**
   * Search for jazz standards by interval sequence
   */
  async searchByIntervals(request: SearchRequest): Promise<SearchResponse> {
    if (this.useMockData) {
      return this.mockSearch(request);
    }

    try {
      const response = await axios.post<SearchResponse>(
        `${API_BASE_URL}/standards/search`,
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error searching standards:', error);
      throw error;
    }
  }

  /**
   * Get all jazz standards (paginated)
   */
  async getAllStandards(page = 1, limit = 20): Promise<SearchResult[]> {
    if (this.useMockData) {
      return MOCK_STANDARDS;
    }

    try {
      const response = await axios.get<SearchResult[]>(
        `${API_BASE_URL}/standards`,
        { params: { page, limit } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching standards:', error);
      throw error;
    }
  }

  /**
   * Get a single standard by ID
   */
  async getStandardById(id: string): Promise<SearchResult | null> {
    if (this.useMockData) {
      return MOCK_STANDARDS.find(s => s.id === id) || null;
    }

    try {
      const response = await axios.get<SearchResult>(
        `${API_BASE_URL}/standards/${id}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching standard:', error);
      throw error;
    }
  }

  /**
   * Mock search implementation for development
   */
  private async mockSearch(request: SearchRequest): Promise<SearchResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const { intervals, tolerance = 0, maxResults = 10 } = request;

    if (intervals.length === 0) {
      return {
        results: [],
        queryTime: 50,
        totalMatches: 0,
      };
    }

    // Simple matching algorithm: check if query intervals are a subsequence
    const matches = MOCK_STANDARDS.filter(standard => {
      return this.findSubsequence(standard.intervalSequence, intervals, tolerance);
    }).map(standard => {
      // Calculate a simple confidence score based on sequence length match
      const confidence = Math.min(0.95, 0.5 + (intervals.length / 10) * 0.45);
      return {
        ...standard,
        matchConfidence: confidence,
      };
    });

    // Sort by confidence and limit results
    const sortedMatches = matches
      .sort((a, b) => b.matchConfidence - a.matchConfidence)
      .slice(0, maxResults);

    return {
      results: sortedMatches,
      queryTime: Math.floor(Math.random() * 100) + 50,
      totalMatches: matches.length,
    };
  }

  /**
   * Check if needle is a subsequence of haystack (with tolerance)
   */
  private findSubsequence(haystack: number[], needle: number[], tolerance: number): boolean {
    if (needle.length > haystack.length) return false;

    for (let i = 0; i <= haystack.length - needle.length; i++) {
      let matches = true;
      for (let j = 0; j < needle.length; j++) {
        const diff = Math.abs(haystack[i + j] - needle[j]);
        if (diff > tolerance) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }

    return false;
  }

  /**
   * Enable or disable mock data mode
   */
  setMockMode(enabled: boolean) {
    this.useMockData = enabled;
  }
}

export const apiService = new ApiService();
export default apiService;
