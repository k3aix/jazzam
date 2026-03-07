import { useState, useCallback, useEffect } from 'react';
import Piano from './components/Piano/Piano';
import ResultsList from './components/SearchResults/ResultsList';
import LoggerConsole from './components/LoggerConsole/LoggerConsole';
import { Note, SearchResult } from './types';
import apiService from './services/api';
import loggerService from './services/loggerService';

const MUSICAL_VALUES = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
const MIN_NOTES = 6; // Backend requires at least 5 non-zero intervals = 6 notes

function computeDurationRatios(notes: Note[]): number[] {
  if (notes.length < 2) return [];

  const iois: number[] = [];
  for (let i = 1; i < notes.length; i++) {
    iois.push(notes[i].timestamp - notes[i - 1].timestamp);
  }

  // Normalize by shortest IOI (floor at 50ms to avoid near-zero divides)
  const minIOI = Math.max(Math.min(...iois), 50);

  return iois.map(ioi => {
    const ratio = ioi / minIOI;
    let closest = MUSICAL_VALUES[0];
    let minDiff = Math.abs(ratio - closest);
    for (const val of MUSICAL_VALUES) {
      const diff = Math.abs(ratio - val);
      if (diff < minDiff) {
        minDiff = diff;
        closest = val;
      }
    }
    return Math.round(closest * 4);
  });
}

function App() {
  const [currentNotes, setCurrentNotes] = useState<Note[]>([]);
  const [currentIntervals, setCurrentIntervals] = useState<number[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
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
    if (!isRecording || currentNotes.length < MIN_NOTES) {
      if (!isRecording) {
        setResults([]);
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
      if (currentNotes.length >= MIN_NOTES) {
        performSearch();
      }
    }
  }, [isRecording, currentIntervals, currentNotes]);

  const performSearch = async () => {
    if (currentIntervals.length < 2) {
      return;
    }

    setIsSearching(true);
    loggerService.logSearchRequest(currentIntervals);

    const durationRatios = computeDurationRatios(currentNotes);
    if (durationRatios.length > 0) {
      loggerService.logSystem(`Duration ratios played: [${durationRatios.join(', ')}]`);
    }

    try {
      // Unified search: use rhythm endpoint (includes pitch data) when duration ratios available,
      // fall back to pitch-only otherwise. Backend sorts by pitch first, rhythm disambiguates.
      const response = durationRatios.length >= 2
        ? await apiService.searchByRhythm({
            intervals: currentIntervals,
            durationRatios,
            maxResults: 10,
          })
        : await apiService.searchByIntervals({
            intervals: currentIntervals,
            tolerance: 0,
            maxResults: 10,
          });

      setResults(response.results);
      setQueryTime(response.queryTime);
      setTotalMatches(response.totalMatches);

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

      if (response.results.length > 0) {
        response.results.forEach((r, i) => {
          const conf = (r.matchConfidence * 100).toFixed(1);
          const pitchStr = r.pitchConfidence ? `, pitch: ${(r.pitchConfidence * 100).toFixed(1)}%` : '';
          const rhythmStr = r.rhythmConfidence ? `, rhythm: ${(r.rhythmConfidence * 100).toFixed(1)}%` : '';
          loggerService.logSystem(
            `#${i + 1}: "${r.title}" - ${conf}%${pitchStr}${rhythmStr}`,
            'success'
          );
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      loggerService.logSearchResponse({
        intervals: currentIntervals,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setResults([]);
    }
    setIsSearching(false);
  };

  const hasResults = !isRecording && (currentIntervals.length >= 2 || results.length > 0);

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
                  {currentNotes.length < MIN_NOTES && (
                    <div className="text-amber-700 font-medium">
                      — need {MIN_NOTES - currentNotes.length} more note{MIN_NOTES - currentNotes.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  {currentNotes.length >= MIN_NOTES && (
                    <div className="text-green-700 font-medium">
                      — searching...
                    </div>
                  )}
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
          {hasResults && (
            <section className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                Search Results
              </h2>
              <ResultsList
                results={results}
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
                  The search compares interval sequences (semitone differences). You need at least {MIN_NOTES} notes for the search to activate — the more notes you play, the better the results!
                </p>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Logger Console */}
      <LoggerConsole
        isOpen={isConsoleOpen}
        onToggle={() => setIsConsoleOpen(prev => !prev)}
      />
    </div>
  );
}

export default App;
