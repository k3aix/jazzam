// Logger Service - Captures and broadcasts application events

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

export type LogCategory =
  | 'note'       // Note played
  | 'interval'   // Interval calculated
  | 'search'     // Search request/response
  | 'match'      // Match found
  | 'system'     // System events
  | 'audio';     // Audio events

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}

export interface SearchLogData {
  intervals: number[];
  queryTime?: number;
  totalMatches?: number;
  results?: Array<{
    title: string;
    confidence: number;
    matchPosition: number;
  }>;
  error?: string;
}

export interface NoteLogData {
  note: string;
  frequency: number;
  isRecording: boolean;
}

export interface IntervalLogData {
  intervals: number[];
  noteCount: number;
}

type LogListener = (entry: LogEntry) => void;

class LoggerService {
  private listeners: Set<LogListener> = new Set();
  private entries: LogEntry[] = [];
  private maxEntries: number = 500;
  private idCounter: number = 0;

  // Subscribe to log events
  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get all entries
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  // Clear all entries
  clear(): void {
    this.entries = [];
    this.broadcast({
      id: this.generateId(),
      timestamp: new Date(),
      level: 'info',
      category: 'system',
      message: 'Log cleared',
    });
  }

  // Log a note being played
  logNote(note: string, frequency: number, isRecording: boolean): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: isRecording ? 'info' : 'debug',
      category: 'note',
      message: isRecording
        ? `Note captured: ${note} (${frequency.toFixed(1)} Hz)`
        : `Note played: ${note}`,
      data: { note, frequency, isRecording } as NoteLogData,
    };
    this.addEntry(entry);
  }

  // Log interval sequence update
  logIntervals(intervals: number[], noteCount: number): void {
    if (intervals.length === 0) return;

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'info',
      category: 'interval',
      message: `Intervals: [${intervals.join(', ')}] (${noteCount} notes)`,
      data: { intervals, noteCount } as IntervalLogData,
    };
    this.addEntry(entry);
  }

  // Log search request
  logSearchRequest(intervals: number[]): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'info',
      category: 'search',
      message: `Searching with ${intervals.length} intervals: [${intervals.join(', ')}]`,
      data: { intervals },
    };
    this.addEntry(entry);
  }

  // Log search response
  logSearchResponse(data: SearchLogData): void {
    const { intervals, queryTime, totalMatches, results, error } = data;

    if (error) {
      this.addEntry({
        id: this.generateId(),
        timestamp: new Date(),
        level: 'error',
        category: 'search',
        message: `Search failed: ${error}`,
        data: { intervals, error },
      });
      return;
    }

    this.addEntry({
      id: this.generateId(),
      timestamp: new Date(),
      level: 'success',
      category: 'search',
      message: `Search completed: ${totalMatches} matches in ${queryTime?.toFixed(0)}ms`,
      data: { intervals, queryTime, totalMatches },
    });

    // Log individual matches
    if (results && results.length > 0) {
      results.forEach((result, index) => {
        const confidencePercent = (result.confidence * 100).toFixed(1);
        this.addEntry({
          id: this.generateId(),
          timestamp: new Date(),
          level: 'success',
          category: 'match',
          message: `#${index + 1}: "${result.title}" - ${confidencePercent}% confidence (pos: ${result.matchPosition})`,
          data: result,
        });
      });
    } else {
      this.addEntry({
        id: this.generateId(),
        timestamp: new Date(),
        level: 'warning',
        category: 'match',
        message: 'No matches found',
        data: { intervals },
      });
    }
  }

  // Log recording state changes
  logRecordingState(isRecording: boolean): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'info',
      category: 'system',
      message: isRecording ? 'Recording started' : 'Recording stopped',
      data: { isRecording },
    };
    this.addEntry(entry);
  }

  // Log audio initialization
  logAudioInit(success: boolean): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: success ? 'success' : 'error',
      category: 'audio',
      message: success ? 'Audio context initialized' : 'Audio initialization failed',
    };
    this.addEntry(entry);
  }

  // Log system messages
  logSystem(message: string, level: LogLevel = 'info'): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      category: 'system',
      message,
    };
    this.addEntry(entry);
  }

  private generateId(): string {
    return `log-${Date.now()}-${++this.idCounter}`;
  }

  private addEntry(entry: LogEntry): void {
    this.entries.push(entry);

    // Trim old entries if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    this.broadcast(entry);
  }

  private broadcast(entry: LogEntry): void {
    this.listeners.forEach(listener => listener(entry));
  }
}

export const loggerService = new LoggerService();
export default loggerService;
