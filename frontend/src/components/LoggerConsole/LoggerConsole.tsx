import { useState, useEffect, useRef, useCallback } from 'react';
import loggerService, { LogEntry, LogLevel, LogCategory } from '../../services/loggerService';

interface LoggerConsoleProps {
  isOpen: boolean;
  onToggle: () => void;
}

const LoggerConsole: React.FC<LoggerConsoleProps> = ({ isOpen, onToggle }) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogCategory | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Subscribe to log events
  useEffect(() => {
    // Load existing entries
    setEntries(loggerService.getEntries());

    // Subscribe to new entries
    const unsubscribe = loggerService.subscribe((entry) => {
      setEntries(prev => [...prev, entry]);
    });

    return unsubscribe;
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const handleClear = useCallback(() => {
    setEntries([]);
    loggerService.clear();
  }, []);

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      case 'debug':
        return 'text-gray-500';
      default:
        return 'text-blue-400';
    }
  };

  const getCategoryBadge = (category: LogCategory): { bg: string; text: string } => {
    switch (category) {
      case 'note':
        return { bg: 'bg-purple-900/50', text: 'text-purple-300' };
      case 'interval':
        return { bg: 'bg-cyan-900/50', text: 'text-cyan-300' };
      case 'search':
        return { bg: 'bg-blue-900/50', text: 'text-blue-300' };
      case 'match':
        return { bg: 'bg-green-900/50', text: 'text-green-300' };
      case 'audio':
        return { bg: 'bg-orange-900/50', text: 'text-orange-300' };
      default:
        return { bg: 'bg-gray-800', text: 'text-gray-400' };
    }
  };

  const formatTime = (date: Date): string => {
    const time = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  };

  const filteredEntries = entries.filter(entry => {
    if (!showDebug && entry.level === 'debug') return false;
    if (filter === 'all') return true;
    return entry.category === filter;
  });

  const categories: Array<{ value: LogCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'note', label: 'Notes' },
    { value: 'interval', label: 'Intervals' },
    { value: 'search', label: 'Search' },
    { value: 'match', label: 'Matches' },
    { value: 'system', label: 'System' },
    { value: 'audio', label: 'Audio' },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-800 transition-colors flex items-center gap-2 z-50"
      >
        <span className="font-mono text-sm">Console</span>
        <span className="bg-blue-500 text-xs px-2 py-0.5 rounded-full">
          {entries.length}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white shadow-2xl z-50 border-t border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-sm">Logger Console</h3>

          {/* Filter buttons */}
          <div className="flex items-center gap-1">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setFilter(cat.value)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filter === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Toggle debug */}
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
              className="rounded"
            />
            Show Debug
          </label>

          {/* Toggle auto-scroll */}
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>

          {/* Entry count */}
          <span className="text-xs text-gray-500">
            {filteredEntries.length} / {entries.length} entries
          </span>

          {/* Clear button */}
          <button
            onClick={handleClear}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            Clear
          </button>

          {/* Close button */}
          <button
            onClick={onToggle}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Minimize
          </button>
        </div>
      </div>

      {/* Console content */}
      <div
        ref={consoleRef}
        className="h-64 overflow-y-auto font-mono text-sm p-2 space-y-0.5"
      >
        {filteredEntries.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No log entries yet. Start playing notes to see activity.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const badgeStyle = getCategoryBadge(entry.category);
            return (
              <div
                key={entry.id}
                className="flex items-start gap-2 py-0.5 hover:bg-gray-800/50 px-1 rounded"
              >
                {/* Timestamp */}
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  {formatTime(entry.timestamp)}
                </span>

                {/* Category badge */}
                <span
                  className={`${badgeStyle.bg} ${badgeStyle.text} px-1.5 py-0.5 rounded text-xs uppercase font-bold whitespace-nowrap`}
                >
                  {entry.category}
                </span>

                {/* Level indicator */}
                <span className={`${getLevelColor(entry.level)} text-xs`}>
                  [{entry.level.toUpperCase()}]
                </span>

                {/* Message */}
                <span className="text-gray-200 flex-1">{entry.message}</span>

                {/* Data preview (if any) */}
                {entry.data && (
                  <button
                    onClick={() => console.log('Log data:', entry.data)}
                    className="text-gray-600 hover:text-gray-400 text-xs"
                    title="Click to log data to browser console"
                  >
                    [data]
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Stats bar */}
      <div className="px-4 py-1.5 bg-gray-800/50 border-t border-gray-700 flex items-center gap-4 text-xs text-gray-500">
        <span>
          Notes: {entries.filter(e => e.category === 'note').length}
        </span>
        <span>
          Searches: {entries.filter(e => e.category === 'search').length}
        </span>
        <span>
          Matches: {entries.filter(e => e.category === 'match').length}
        </span>
        <span>
          Errors: {entries.filter(e => e.level === 'error').length}
        </span>
      </div>
    </div>
  );
};

export default LoggerConsole;
