import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PianoKey from './PianoKey';
import { PianoKey as PianoKeyType, Note } from '../../types';
import audioService from '../../services/audioService';
import keyboardMapping, { KeyboardLayout } from '../../services/keyboardMapping';
import loggerService from '../../services/loggerService';

interface PianoProps {
  onMelodyChange: (notes: Note[], intervals: number[]) => void;
  isRecording: boolean;
  onRecordingToggle: () => void;
}

const Piano: React.FC<PianoProps> = ({ onMelodyChange, isRecording, onRecordingToggle }) => {
  const [playedNotes, setPlayedNotes] = useState<Note[]>([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [currentOctave, setCurrentOctave] = useState(4);
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>('QWERTY');
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set()); // Track currently playing notes for visual feedback
  const pressedKeys = useRef<Set<string>>(new Set()); // Track pressed keyboard keys
  const playedNotesRef = useRef<Note[]>([]); // Keep ref to avoid stale closures

  // Memoize piano keys generation - only create once
  const pianoKeys = useMemo((): PianoKeyType[] => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keys: PianoKeyType[] = [];

    // C4 (middle C) starts at MIDI note 60
    const startMidiNumber = 60;

    // Generate 2 octaves (24 notes)
    for (let i = 0; i < 24; i++) {
      const midiNumber = startMidiNumber + i;
      const octave = Math.floor(midiNumber / 12) - 1;
      const noteIndex = midiNumber % 12;
      const noteName = notes[noteIndex];
      const fullNote = `${noteName}${octave}`;

      // Calculate frequency: f = 440 * 2^((n-69)/12) where n is MIDI number
      const frequency = 440 * Math.pow(2, (midiNumber - 69) / 12);

      keys.push({
        note: fullNote,
        frequency: Math.round(frequency * 100) / 100,
        type: noteName.includes('#') ? 'black' : 'white',
        midiNumber
      });
    }

    return keys;
  }, []); // Empty dependency array - only generate once

  // Calculate intervals from notes (semitone differences)
  const calculateIntervals = (notes: Note[]): number[] => {
    if (notes.length < 2) return [];

    const intervals: number[] = [];
    for (let i = 1; i < notes.length; i++) {
      // Find MIDI numbers for the notes
      const prevKey = pianoKeys.find(k => k.note === notes[i - 1].name);
      const currKey = pianoKeys.find(k => k.note === notes[i].name);

      if (prevKey && currKey) {
        intervals.push(currKey.midiNumber - prevKey.midiNumber);
      }
    }

    return intervals;
  };

  // Sync playedNotes to ref to avoid stale closures
  useEffect(() => {
    playedNotesRef.current = playedNotes;
  }, [playedNotes]);

  const handleNoteStart = useCallback((note: string, frequency: number) => {
    // Always play sound immediately - no state updates needed
    audioService.playNote(note, frequency);

    // Log the note
    loggerService.logNote(note, frequency, isRecording);

    // Add to active notes for visual feedback
    setActiveNotes(prev => {
      const newSet = new Set(prev);
      newSet.add(note);
      return newSet;
    });

    // Only capture notes if recording
    if (isRecording) {
      const timestamp = Date.now() - startTime;

      const newNote: Note = {
        name: note,
        frequency,
        timestamp,
        octave: parseInt(note.slice(-1)),
        pitchClass: note.slice(0, -1)
      };

      setPlayedNotes(current => {
        const updatedNotes = [...current, newNote];
        const intervals = calculateIntervals(updatedNotes);
        onMelodyChange(updatedNotes, intervals);
        return updatedNotes;
      });
    }
  }, [startTime, onMelodyChange, isRecording, calculateIntervals]);

  const handleNoteEnd = useCallback((note: string) => {
    // Stop the sound
    audioService.stopNote(note);

    // Remove from active notes
    setActiveNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(note);
      return newSet;
    });
  }, []);

  const handleReset = () => {
    setPlayedNotes([]);
    setStartTime(Date.now()); // Reset timestamp
    onMelodyChange([], []);
    audioService.stopAll(); // Stop any playing notes
    setActiveNotes(new Set()); // Clear active notes
  };

  const handleRecordingToggle = () => {
    if (!isRecording) {
      // Starting recording - reset notes and timer
      setPlayedNotes([]);
      setStartTime(Date.now());
      onMelodyChange([], []);
    }
    onRecordingToggle();
  };

  const handleOctaveUp = useCallback(() => {
    const newOctave = keyboardMapping.octaveUp();
    setCurrentOctave(newOctave);
  }, []);

  const handleOctaveDown = useCallback(() => {
    const newOctave = keyboardMapping.octaveDown();
    setCurrentOctave(newOctave);
  }, []);

  const handleKeyboardLayoutChange = (layout: KeyboardLayout) => {
    setKeyboardLayout(layout);
    keyboardMapping.setLayout(layout);
  };

  // Initialize audio on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioInitialized) {
        audioService.initialize();
        setAudioInitialized(true);
        loggerService.logAudioInit(true);
      }
    };

    // Initialize on first click anywhere
    document.addEventListener('click', initAudio, { once: true });
    return () => document.removeEventListener('click', initAudio);
  }, [audioInitialized]);

  // Keyboard input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for mapped keys
      if (keyboardMapping.isKeyMapped(e.key)) {
        e.preventDefault();
      }

      // Ignore if key is already pressed (prevent key repeat)
      if (pressedKeys.current.has(e.key)) return;

      // Check for octave shift keys (comma = down, period = up)
      if (e.key === ',' || e.key === '<') {
        handleOctaveDown();
        return;
      }
      if (e.key === '.' || e.key === '>') {
        handleOctaveUp();
        return;
      }

      // Get note for this key
      const note = keyboardMapping.getNoteForKey(e.key);
      if (!note) return;

      // Find the piano key data
      const keyData = pianoKeys.find(k => k.note === note);
      if (!keyData) return;

      // Mark key as pressed
      pressedKeys.current.add(e.key);

      // Play the note
      handleNoteStart(keyData.note, keyData.frequency);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Get note for this key
      const note = keyboardMapping.getNoteForKey(e.key);
      if (!note) return;

      // Mark key as released
      pressedKeys.current.delete(e.key);

      // Stop the note
      handleNoteEnd(note);
    };

    // Add listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Stop all notes when unmounting
      pressedKeys.current.clear();
      audioService.stopAll();
      setActiveNotes(new Set());
    };
  }, [handleNoteStart, handleNoteEnd, handleOctaveUp, handleOctaveDown, pianoKeys]);

  // Render keys in proper piano layout
  const renderKeys = () => {
    const whiteKeys = pianoKeys.filter(k => k.type === 'white');
    const blackKeys = pianoKeys.filter(k => k.type === 'black');

    return (
      <div className="relative flex">
        {/* White keys */}
        {whiteKeys.map((key) => (
          <div key={key.note} className="relative">
            <PianoKey
              keyData={key}
              onNoteStart={handleNoteStart}
              onNoteEnd={handleNoteEnd}
              isActive={activeNotes.has(key.note)}
              keyboardKey={keyboardMapping.getKeyForNote(key.note)}
            />
          </div>
        ))}

        {/* Black keys positioned absolutely over white keys */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {blackKeys.map((key) => {
            // Calculate left position to place black keys between white keys
            const getLeftPosition = () => {
              const octave = parseInt(key.note.slice(-1));
              const note = key.note.slice(0, -1);
              const octaveOffset = (octave - 4) * 7; // 7 white keys per octave

              // Position black keys in the upper middle between white keys
              const positions: { [key: string]: number } = {
                'C#': 0.68,  // Between C and D
                'D#': 1.68,  // Between D and E
                'F#': 3.68,  // Between F and G
                'G#': 4.68,  // Between G and A
                'A#': 5.68,  // Between A and B
              };

              return (octaveOffset + (positions[note] || 0)) * 48; // 48px = width of white key
            };

            return (
              <div
                key={key.note}
                className="pointer-events-auto"
                style={{ position: 'absolute', left: `${getLeftPosition()}px`, top: '0px' }}
              >
                <PianoKey
                  keyData={key}
                  onNoteStart={handleNoteStart}
                  onNoteEnd={handleNoteEnd}
                  isActive={activeNotes.has(key.note)}
                  keyboardKey={keyboardMapping.getKeyForNote(key.note)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Virtual Piano</h2>
        <p className="text-gray-600">
          {isRecording
            ? '🔴 Recording - Play your melody to identify it'
            : 'Play freely - Click keys or use your keyboard'}
        </p>
        <div className="mt-3 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 font-medium">Keyboard Layout:</span>
            <select
              value={keyboardLayout}
              onChange={(e) => handleKeyboardLayoutChange(e.target.value as KeyboardLayout)}
              className="px-3 py-1.5 border-2 border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="QWERTY">QWERTY (US/UK)</option>
              <option value="QWERTZ">QWERTZ (German)</option>
              <option value="AZERTY">AZERTY (French)</option>
            </select>
          </div>
          <div className="border-l-2 border-gray-300 pl-6 flex items-center gap-4">
            <span className="text-blue-600 font-medium">
              Octave: C{currentOctave}
            </span>
            <span className="text-gray-500">
              , / . to shift
            </span>
          </div>
        </div>
      </div>

      {/* Piano keyboard */}
      <div className="bg-gray-200 p-6 rounded-lg shadow-2xl">
        {renderKeys()}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 items-center w-full max-w-2xl">
        {/* Octave controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleOctaveDown}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            disabled={currentOctave <= 2}
          >
            ← Octave Down (,)
          </button>
          <span className="text-lg font-bold text-gray-700 min-w-20 text-center">
            C{currentOctave} - B{currentOctave}
          </span>
          <button
            onClick={handleOctaveUp}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            disabled={currentOctave >= 6}
          >
            Octave Up (.) →
          </button>
        </div>

        {/* Recording controls */}
        <div className="flex gap-4 items-center">
          <button
            onClick={handleRecordingToggle}
            className={`px-8 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              isRecording
                ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                : 'bg-gray-700 text-white hover:bg-gray-800'
            }`}
          >
            {isRecording ? (
              <>
                <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                RECORDING
              </>
            ) : (
              <>
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                START RECORDING
              </>
            )}
          </button>

          {playedNotes.length > 0 && (
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear Melody
            </button>
          )}

          {!audioInitialized && (
            <span className="text-sm text-gray-500 italic">
              Click anywhere to enable sound
            </span>
          )}
        </div>
      </div>

      {/* Display played notes */}
      {playedNotes.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-md w-full max-w-2xl">
          <h3 className="font-semibold mb-2 text-gray-700">Played Notes:</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {playedNotes.map((note, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-mono"
              >
                {note.name}
              </span>
            ))}
          </div>

          {playedNotes.length > 1 && (
            <>
              <h3 className="font-semibold mb-2 text-gray-700">Interval Sequence:</h3>
              <div className="flex flex-wrap gap-2">
                {calculateIntervals(playedNotes).map((interval, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-full text-sm font-mono ${
                      interval > 0
                        ? 'bg-green-100 text-green-800'
                        : interval < 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {interval > 0 ? '+' : ''}{interval}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Piano;
