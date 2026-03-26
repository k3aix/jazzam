import { useState } from 'react';
import { SearchResult } from '../../types';
import StandardCard from './StandardCard';

interface ResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  queryTime?: number;
  totalMatches?: number;
  onConfirm?: (result: SearchResult) => void;
  onNoneCorrect?: () => void;
}

const ResultsList: React.FC<ResultsListProps> = ({
  results,
  isLoading,
  queryTime,
  totalMatches,
  onConfirm,
  onNoneCorrect,
}) => {
  const [noneDismissed, setNoneDismissed] = useState(false);
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
        {queryTime && (
          <span className="text-xs text-slate-600">{queryTime}ms</span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-2">
        {results.map((result) => (
          <StandardCard key={result.id} result={result} onConfirm={onConfirm} />
        ))}
      </div>

      <div className="mt-5 flex justify-center">
        {noneDismissed ? (
          <span className="text-slate-500 text-sm">✗ Reported as incorrect</span>
        ) : (
          <button
            onClick={() => { setNoneDismissed(true); onNoneCorrect?.(); }}
            className="px-4 py-2 text-sm text-slate-500 border border-slate-700 rounded-lg hover:border-slate-500 hover:text-slate-300 transition-colors"
          >
            None of these are correct
          </button>
        )}
      </div>
    </div>
  );
};

export default ResultsList;
