import { useState, useCallback, useEffect } from 'react';
import Piano from './components/Piano/Piano';
import ResultsList from './components/SearchResults/ResultsList';
import LoggerConsole from './components/LoggerConsole/LoggerConsole';
import { Note, SearchResult } from './types';
import apiService from './services/api';
import loggerService from './services/loggerService';

function App() {
  const [currentNotes, setCurrentNotes] = useState<Note[]>([]);
  const [currentIntervals, setCurrentIntervals] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryTime, setQueryTime] = useState<number | undefined>();
  const [totalMatches, setTotalMatches] = useState<number | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);

  const handleMelodyChange = useCallback((notes: Note[], intervals: number[]) => {
    setCurrentNotes(notes);
    setCurrentIntervals(intervals);
    if (intervals.length > 0) {
      loggerService.logIntervals(intervals, notes.length);
    }
  }, []);

  // Auto-search when intervals change while recording (with debounce)
  useEffect(() => {
    if (!isRecording || currentIntervals.length < 2) {
      if (!isRecording) {
        setSearchResults([]);
      }
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch();
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [currentIntervals, isRecording]);

  const handleRecordingToggle = useCallback(() => {
    const newRecordingState = !isRecording;
    setIsRecording(newRecordingState);
    loggerService.logRecordingState(newRecordingState);
    if (isRecording) {
      // Stopped recording - do final search if we have notes
      if (currentIntervals.length >= 2) {
        performSearch();
      }
    }
  }, [isRecording, currentIntervals]);

  const performSearch = async () => {
    if (currentIntervals.length < 2) {
      return;
    }

    setIsSearching(true);
    loggerService.logSearchRequest(currentIntervals);

    try {
      const response = await apiService.searchByIntervals({
        intervals: currentIntervals,
        tolerance: 0,
        maxResults: 10,
      });

      setSearchResults(response.results);
      setQueryTime(response.queryTime);
      setTotalMatches(response.totalMatches);

      // Log search results
      loggerService.logSearchResponse({
        intervals: currentIntervals,
        queryTime: response.queryTime,
        totalMatches: response.totalMatches,
        results: response.results.map(r => ({
          title: r.title,
          confidence: r.matchConfidence,
          matchPosition: r.matchPosition,
        })),
      });
    } catch (error) {
      console.error('Search failed:', error);
      loggerService.logSearchResponse({
        intervals: currentIntervals,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 ${isConsoleOpen ? 'pb-80' : 'pb-16'}`}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-blue-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Jazz Melody Finder
              </h1>
              <p className="text-gray-600 mt-1">
                Play a melody and discover which jazz standard it belongs to
              </p>
            </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Piano Section */}
          <section className="bg-white rounded-xl shadow-lg p-8">
            <Piano
              onMelodyChange={handleMelodyChange}
              isRecording={isRecording}
              onRecordingToggle={handleRecordingToggle}
            />
          </section>

          {/* Recording Status */}
          {currentNotes.length > 0 && isRecording && (
            <section className="bg-red-50 border-2 border-red-200 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-red-600 rounded-full animate-pulse"></span>
                    <span className="font-semibold text-red-900">Recording in progress</span>
                  </div>
                  <div className="text-gray-700">
                    <span className="font-semibold">{currentNotes.length}</span> notes captured,{' '}
                    <span className="font-semibold">{currentIntervals.length}</span> intervals
                  </div>
                </div>
                <button
                  onClick={handleRecordingToggle}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  STOP & SEARCH
                </button>
              </div>
            </section>
          )}

          {/* Results Section */}
          {!isRecording && (currentIntervals.length >= 2 || searchResults.length > 0) && (
            <section className="bg-white rounded-xl shadow-lg p-8">
              <ResultsList
                results={searchResults}
                isLoading={isSearching}
                queryTime={queryTime}
                totalMatches={totalMatches}
              />
            </section>
          )}

          {/* Instructions */}
          {currentNotes.length === 0 && (
            <section className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">How to Use</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center text-center">
                  <div className="text-4xl mb-3">🎹</div>
                  <h3 className="font-semibold text-lg mb-2">1. Play Freely</h3>
                  <p className="text-gray-600">
                    Click the piano keys to hear sounds. Play around and practice!
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="text-4xl mb-3">🔴</div>
                  <h3 className="font-semibold text-lg mb-2">2. Start Recording</h3>
                  <p className="text-gray-600">
                    Click "START RECORDING" and play a melody you want to identify
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="text-4xl mb-3">📖</div>
                  <h3 className="font-semibold text-lg mb-2">3. View Results</h3>
                  <p className="text-gray-600">
                    Stop recording to see matched jazz standards with confidence scores
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>🎵 How it works:</strong> The piano always plays sound, but only captures notes when recording.
                  The search compares interval sequences (semitone differences). Record at least 3-4 notes for better results!
                </p>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t-2 border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>
            Jazz Melody Finder - A learning project for microservices, cloud infrastructure, and DevOps
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Technologies: React, TypeScript, C#, PostgreSQL, Kubernetes, AWS
          </p>
        </div>
      </footer>

      {/* Logger Console */}
      <LoggerConsole
        isOpen={isConsoleOpen}
        onToggle={() => setIsConsoleOpen(prev => !prev)}
      />
    </div>
  );
}

export default App;
