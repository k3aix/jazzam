import { SearchResult } from '../../types';

interface StandardCardProps {
  result: SearchResult;
}

const StandardCard: React.FC<StandardCardProps> = ({ result }) => {
  const confidencePercentage = Math.round(result.matchConfidence * 100);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800 border-green-300';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-orange-100 text-orange-800 border-orange-300';
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors shadow-sm hover:shadow-md">
      {/* Header with title and confidence */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-800 mb-1">{result.title}</h3>
          <p className="text-gray-600">
            by <span className="font-semibold">{result.composer}</span>
            {result.year && <span className="text-gray-500"> ({result.year})</span>}
          </p>
        </div>

        <div className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${getConfidenceColor(result.matchConfidence)}`}>
          {confidencePercentage}% match
        </div>
      </div>

      {/* Musical details */}
      <div className="flex gap-4 mb-3 text-sm">
        {result.key && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Key:</span>
            <span className="font-mono font-semibold text-gray-700">{result.key}</span>
          </div>
        )}
        {result.timeSignature && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Time:</span>
            <span className="font-mono font-semibold text-gray-700">{result.timeSignature}</span>
          </div>
        )}
      </div>

      {/* Interval sequence visualization */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-1">Interval Sequence:</p>
        <div className="flex flex-wrap gap-1">
          {result.intervalSequence.slice(0, 12).map((interval, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 rounded text-xs font-mono ${
                i >= result.matchPosition && i < result.matchPosition + 4
                  ? 'bg-blue-200 text-blue-900 font-bold'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {interval > 0 ? '+' : ''}{interval}
            </span>
          ))}
          {result.intervalSequence.length > 12 && (
            <span className="text-gray-400 text-xs">...</span>
          )}
        </div>
      </div>

      {/* Book source */}
      {result.bookSource && (
        <div className="text-xs text-gray-500 flex justify-between">
          <span>{result.bookSource}</span>
          {result.pageNumber && <span>Page {result.pageNumber}</span>}
        </div>
      )}
    </div>
  );
};

export default StandardCard;
