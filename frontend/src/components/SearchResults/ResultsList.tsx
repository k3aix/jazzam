import { SearchResult } from '../../types';
import StandardCard from './StandardCard';

interface ResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  queryTime?: number;
  totalMatches?: number;
}

const ResultsList: React.FC<ResultsListProps> = ({
  results,
  isLoading,
  queryTime,
  totalMatches,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Searching jazz standards...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎵</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No matches found
        </h3>
        <p className="text-gray-600">
          Try playing a different melody or more notes for better results.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Results header */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          Found {totalMatches || results.length} {results.length === 1 ? 'match' : 'matches'}
        </h2>
        {queryTime && (
          <span className="text-sm text-gray-500">
            Search took {queryTime}ms
          </span>
        )}
      </div>

      {/* Results grid */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        {results.map((result) => (
          <StandardCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
};

export default ResultsList;
