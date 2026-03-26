import { useState } from 'react';
import { SearchResult } from '../../types';

interface StandardCardProps {
  result: SearchResult;
  onConfirm?: (result: SearchResult) => void;
}

const StandardCard: React.FC<StandardCardProps> = ({ result, onConfirm }) => {
  const [confirmed, setConfirmed] = useState(false);
  const confidencePercentage = Math.round(result.matchConfidence * 100);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-emerald-400';
    if (confidence >= 0.7) return 'text-amber-400';
    return 'text-orange-400';
  };

  const getBarColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'bg-emerald-400';
    if (confidence >= 0.7) return 'bg-amber-400';
    return 'bg-orange-400';
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm?.(result);
  };

  return (
    <div
      onClick={!confirmed ? handleConfirm : undefined}
      className={`bg-slate-900 border rounded-xl p-5 transition-all duration-200 hover:shadow-lg ${
        confirmed
          ? 'border-emerald-500/60 shadow-emerald-500/10 cursor-default'
          : 'border-slate-700 hover:border-amber-400/40 hover:shadow-amber-400/5 cursor-pointer'
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="text-lg font-bold text-white truncate">{result.title}</h3>
          {result.year && <p className="text-slate-400 text-sm mt-0.5">{result.year}</p>}
        </div>
        <div className={`text-2xl font-bold tabular-nums ${getConfidenceColor(result.matchConfidence)}`}>
          {confidencePercentage}%
        </div>
      </div>

      {/* Confidence bar */}
      <div className="h-1 bg-slate-700 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${getBarColor(result.matchConfidence)}`}
          style={{ width: `${confidencePercentage}%` }}
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

      {/* Footer: key + confirm indicator */}
      <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
        <div className="flex gap-3">
          {result.key && <span>Key <span className="text-slate-300 font-mono">{result.key}</span></span>}
        </div>
        {confirmed && (
          <span className="text-emerald-400 font-semibold">✓ Confirmed</span>
        )}
      </div>
    </div>
  );
};

export default StandardCard;
