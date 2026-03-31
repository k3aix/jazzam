import { useState } from 'react';
import { SearchResult } from '../../types';
import StandardCard from './StandardCard';

interface ResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  queryTime?: number;
  totalMatches?: number;
  onConfirm?: (result: SearchResult) => void;
  onNoneCorrect?: (knownTitle?: string) => void;
  onClear?: () => void;
}

const ResultsList: React.FC<ResultsListProps> = ({
  results,
  isLoading,
  queryTime,
  totalMatches,
  onConfirm,
  onNoneCorrect,
  onClear,
}) => {
  const [noneDismissed, setNoneDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [knownTitle, setKnownTitle] = useState('');

  const handleSubmit = () => {
    setShowModal(false);
    setNoneDismissed(true);
    onNoneCorrect?.(knownTitle.trim() || undefined);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400"></div>
        <p className="mt-4 text-slate-400 text-sm">Searching jazz standards...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🎵</div>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No matches found</h3>
        <p className="text-slate-500 text-sm">Try playing a different melody or more notes.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex justify-between items-center">
        <h2 className="text-base font-semibold text-slate-300">
          {totalMatches || results.length} {results.length === 1 ? 'match' : 'matches'} found
        </h2>
        <div className="flex items-center gap-3">
          {onClear && (
            <button onClick={onClear} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              clear
            </button>
          )}
          {queryTime && (
            <span className="text-xs text-slate-600">{queryTime}ms</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-2">
        {results.map((result, index) => (
          <StandardCard key={result.id} result={result} rank={index + 1} onConfirm={onConfirm} />
        ))}
      </div>

      <div className="mt-5 flex justify-center">
        {noneDismissed ? (
          <span className="text-slate-500 text-sm">✗ Reported as incorrect</span>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-400 border border-red-800 rounded-lg hover:bg-red-950 hover:border-red-600 hover:text-red-300 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
            </svg>
            None of these are correct
          </button>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-red-900/60 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
                </svg>
              </div>
              <h3 className="text-white font-semibold">None of these are correct</h3>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              Do you know the title? It helps improve the search.
            </p>

            <input
              type="text"
              value={knownTitle}
              onChange={(e) => setKnownTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Autumn Leaves (optional)"
              autoFocus
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsList;
