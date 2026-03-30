import { useState } from 'react';
import { SearchResult } from '../../types';

interface StandardCardProps {
  result: SearchResult;
  rank: number;
  onConfirm?: (result: SearchResult) => void;
}

const isDev = import.meta.env.DEV;

const getBarColor = (confidence: number): string => {
  if (confidence >= 0.85) return 'bg-emerald-400';
  if (confidence >= 0.70) return 'bg-amber-400';
  return 'bg-orange-400';
};

// 5 ascending-height bars based on combined (pitch+rhythm) confidence
const SignalBars: React.FC<{ confidence: number }> = ({ confidence }) => {
  const filled = confidence >= 0.92 ? 5 : confidence >= 0.85 ? 4 : confidence >= 0.75 ? 3 : confidence >= 0.65 ? 2 : 1;
  const colorClass = getBarColor(confidence);
  return (
    <div className="flex items-end gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm ${i < filled ? colorClass : 'bg-slate-700'}`}
          style={{ height: `${(i + 1) * 4 + 4}px` }}
        />
      ))}
    </div>
  );
};

const StandardCard: React.FC<StandardCardProps> = ({ result, rank, onConfirm }) => {
  const [confirmed, setConfirmed] = useState(false);
  // Weighted score: pitch counts 70%, rhythm 30%. Falls back to pitch-only if no rhythm data.
  const scoreForBars = result.pitchConfidence != null && result.rhythmConfidence != null
    ? result.pitchConfidence * 0.7 + result.rhythmConfidence * 0.3
    : result.matchConfidence;

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm?.(result);
  };

  return (
    <div className={`bg-slate-900 border rounded-xl p-5 transition-all duration-200 ${
      confirmed ? 'border-emerald-500/60' : 'border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="text-lg font-bold text-white truncate">{result.title}</h3>
          {result.year && <p className="text-slate-400 text-sm mt-0.5">{result.year}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {isDev ? (
            <SignalBars confidence={scoreForBars} />
          ) : (
            <span className="text-slate-300 text-sm font-bold">#{rank}</span>
          )}
        </div>
      </div>

      {/* Combined confidence bar (pitch+rhythm) */}
      <div className="h-1.5 bg-slate-700 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full ${getBarColor(scoreForBars)}`}
          style={{ width: `${Math.round(scoreForBars * 100)}%` }}
        />
      </div>

      {/* Pitch/Rhythm breakdown */}
      {(result.pitchConfidence != null || result.rhythmConfidence != null) && (
        <div className="flex gap-4 mb-3 text-xs text-slate-500">
          {result.pitchConfidence != null && (
            <span>Pitch <span className="text-slate-300 font-semibold">{Math.round(result.pitchConfidence * 100)}%</span></span>
          )}
          {result.rhythmConfidence != null && (
            <span>Rhythm <span className="text-slate-300 font-semibold">{Math.round(result.rhythmConfidence * 100)}%</span></span>
          )}
        </div>
      )}

      {/* Footer: key + confirm button */}
      <div className="flex justify-between items-center mt-2">
        <div className="text-xs text-slate-500">
          {result.key && <span>Key <span className="text-slate-300 font-mono">{result.key}</span></span>}
        </div>
        {confirmed ? (
          <span className="text-emerald-400 text-sm font-semibold">✓ Found it!</span>
        ) : (
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            This is it!
          </button>
        )}
      </div>
    </div>
  );
};

export default StandardCard;
