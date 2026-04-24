import { useState, useCallback, useEffect, useRef } from 'react';
import Piano from './components/Piano/Piano';
import ResultsList from './components/SearchResults/ResultsList';
import AdminPage from './components/Admin/AdminPage';
import { Note, SearchResult } from './types';
import apiService from './services/api';
import loggerService from './services/loggerService';

const MUSICAL_VALUES = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
const MIN_NOTES = 6; // Backend requires at least 5 non-zero intervals = 6 notes

// When true: if the last search in a recording session returns empty, fall back to the
// best result seen earlier in the session rather than showing nothing.
// Set to false to keep the default behaviour (always show the last search result only).
const SHOW_BEST_SESSION_RESULT_AS_FALLBACK = false;

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
  if (window.location.pathname === '/admin') return <AdminPage />;

  const [currentNotes, setCurrentNotes] = useState<Note[]>([]);
  const [currentIntervals, setCurrentIntervals] = useState<number[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryTime, setQueryTime] = useState<number | undefined>();
  const [totalMatches, setTotalMatches] = useState<number | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const lastSearchedIntervalsRef = useRef<number[]>([]);
  const bestResultsDuringRecordingRef = useRef<SearchResult[]>([]);
  const bestQueryTimeDuringRecordingRef = useRef<number | undefined>(undefined);
  const confirmedRef = useRef(false);

  const handleMelodyChange = useCallback((notes: Note[], intervals: number[]) => {
    setCurrentNotes(notes);
    setCurrentIntervals(intervals);
    if (intervals.length > 0) {
      loggerService.logIntervals(intervals, notes.length);
    }
  }, []);

  // Auto-search when intervals change while recording (with debounce)
  useEffect(() => {
    if (!isRecording || currentNotes.length < MIN_NOTES) return;

    const timeoutId = setTimeout(() => {
      performSearch();
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [currentIntervals, isRecording]);

  const handleRecordingToggle = useCallback(() => {
    const newRecordingState = !isRecording;
    setIsRecording(newRecordingState);
    loggerService.logRecordingState(newRecordingState);
    if (!isRecording) {
      // Starting recording - clear previous results and reset trackers
      setResults([]);
      lastSearchedIntervalsRef.current = [];
      bestResultsDuringRecordingRef.current = [];
      bestQueryTimeDuringRecordingRef.current = undefined;
      confirmedRef.current = false;
    } else {
      // Stopped recording - only search if the debounce hasn't already searched this exact sequence
      if (currentNotes.length >= MIN_NOTES &&
          currentIntervals.length !== lastSearchedIntervalsRef.current.length) {
        performSearch();
      }
    }
  }, [isRecording, currentIntervals, currentNotes]);

  const performSearch = async () => {
    if (currentIntervals.length < 2) {
      return;
    }

    lastSearchedIntervalsRef.current = currentIntervals;
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

      // Track the best result set seen during this recording session.
      // "Best" = highest top-result confidence. Used as fallback if a later search returns empty.
      const topConfidence = response.results[0]?.matchConfidence ?? 0;
      const bestConfidence = bestResultsDuringRecordingRef.current[0]?.matchConfidence ?? 0;
      if (topConfidence > bestConfidence) {
        bestResultsDuringRecordingRef.current = response.results;
        bestQueryTimeDuringRecordingRef.current = response.queryTime;
      }

      // If this search returned nothing but we have a better result from earlier in the session, keep it.
      const resultsToShow = (SHOW_BEST_SESSION_RESULT_AS_FALLBACK && response.results.length === 0)
        ? bestResultsDuringRecordingRef.current
        : response.results;
      const queryTimeToShow = (SHOW_BEST_SESSION_RESULT_AS_FALLBACK && response.results.length === 0)
        ? bestQueryTimeDuringRecordingRef.current
        : response.queryTime;

      if (!confirmedRef.current) {
        setResults(resultsToShow);
        setQueryTime(queryTimeToShow);
        setTotalMatches(resultsToShow.length);
      }

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
      if (!confirmedRef.current) {
        const fallback = SHOW_BEST_SESSION_RESULT_AS_FALLBACK ? bestResultsDuringRecordingRef.current : [];
        if (fallback.length > 0) {
          setResults(fallback);
          setQueryTime(bestQueryTimeDuringRecordingRef.current);
          setTotalMatches(fallback.length);
        } else {
          setResults([]);
        }
      }
    }
    setIsSearching(false);
  };

  const handleConfirm = useCallback((result: SearchResult) => {
    confirmedRef.current = true;
    const durationRatios = computeDurationRatios(currentNotes);
    const matchedDbIntervals = result.intervalSequence.slice(
      result.matchPosition,
      result.matchPosition + result.matchLength
    );
    apiService.submitFeedback({
      standardId: result.id,
      title: result.title,
      confidence: result.matchConfidence,
      intervals: currentIntervals,
      durationRatios,
      matchPosition: result.matchPosition,
      matchLength: result.matchLength,
      matchedDbIntervals,
    });
  }, [currentNotes, currentIntervals]);

  const handleNoneCorrect = useCallback((knownTitle?: string) => {
    const durationRatios = computeDurationRatios(currentNotes);
    apiService.submitFeedback({
      standardId: 'none',
      title: knownTitle ? `NONE_CORRECT (user says: "${knownTitle}")` : 'NONE_CORRECT',
      confidence: 0,
      intervals: currentIntervals,
      durationRatios,
    });
  }, [currentNotes, currentIntervals]);

  const hasResults = !isRecording && (currentIntervals.length >= 2 || results.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Jazz<span className="text-amber-400">am</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm tracking-wide uppercase">
            Melody identification for jazz standards
          </p>
        </div>
      </header>

      {/* Dataset notice banner */}
      <div className="border-b border-amber-400/20 bg-amber-400/5">
        <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center gap-2.5 text-sm text-amber-300/80">
          <svg className="w-4 h-4 shrink-0 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
          <span>
            Dataset in active development — jazz standards are added gradually. If a tune isn't found yet, check back soon.
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="space-y-6">
          {/* Piano Section */}
          <section className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
            <Piano
              onMelodyChange={handleMelodyChange}
              isRecording={isRecording}
              onRecordingToggle={handleRecordingToggle}
            />
          </section>

          {/* Recording Status */}
          {currentNotes.length > 0 && isRecording && (
            <section className="bg-slate-800 border border-red-500/40 rounded-2xl shadow-lg px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="font-semibold text-white">Recording</span>
                  <span className="text-slate-400 text-sm">
                    {currentNotes.length} notes
                  </span>
                  {currentNotes.length < MIN_NOTES && (
                    <span className="text-amber-400 text-sm">
                      — {MIN_NOTES - currentNotes.length} more needed
                    </span>
                  )}
                  {currentNotes.length >= MIN_NOTES && (
                    <span className="text-emerald-400 text-sm">— searching...</span>
                  )}
                </div>
                <button
                  onClick={handleRecordingToggle}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold tracking-wide"
                >
                  STOP
                </button>
              </div>
            </section>
          )}

          {/* Results Section */}
          {hasResults && (
            <section className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
              <ResultsList
                results={results}
                isLoading={isSearching}
                queryTime={queryTime}
                totalMatches={totalMatches}
                onConfirm={handleConfirm}
                onNoneCorrect={handleNoneCorrect}
                onClear={() => { setResults([]); setQueryTime(undefined); setTotalMatches(undefined); }}
              />
            </section>
          )}

          {/* Instructions */}
          {currentNotes.length === 0 && (
            <section className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-6">How to use</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-2">
                  <div className="text-2xl">🎹</div>
                  <h3 className="font-semibold text-slate-200">1. Play freely</h3>
                  <p className="text-slate-400 text-sm">
                    Click the piano keys to hear sounds. Practice without recording.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-2xl">🔴</div>
                  <h3 className="font-semibold text-slate-200">2. Start recording</h3>
                  <p className="text-slate-400 text-sm">
                    Hit "START RECORDING" and play the melody you want to identify.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-2xl">📖</div>
                  <h3 className="font-semibold text-slate-200">3. View results</h3>
                  <p className="text-slate-400 text-sm">
                    Stop recording to see matched jazz standards with confidence scores.
                  </p>
                </div>
              </div>
              <p className="mt-6 text-slate-500 text-xs">
                You need at least {MIN_NOTES} notes to trigger a search — the more you play, the better the results.
              </p>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-10">
        <div className="max-w-5xl mx-auto px-6 py-5 text-center text-xs text-slate-600">
          Dataset in active development · jazz standards added regularly · results improve over time
        </div>
      </footer>
    </div>
  );
}

export default App;
