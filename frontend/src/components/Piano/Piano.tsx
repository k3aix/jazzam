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
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>('QWERTY');
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set()); // Track currently playing notes for visual feedback
  const pressedKeys = useRef<Set<string>>(new Set()); // Track pressed keyboard keys
  const playedNotesRef = useRef<Note[]>([]); // Keep ref to avoid stale closures
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate full piano range (C2 to B6 = 5 octaves, 60 notes)
  const pianoKeys = useMemo((): PianoKeyType[] => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keys: PianoKeyType[] = [];

    // C2 = MIDI 36, B6 = MIDI 95 → 5 octaves
    for (let midiNumber = 36; midiNumber <= 95; midiNumber++) {
      const octave = Math.floor(midiNumber / 12) - 1;
      const noteIndex = midiNumber % 12;
      const noteName = notes[noteIndex];
      const fullNote = `${noteName}${octave}`;

      const frequency = 440 * Math.pow(2, (midiNumber - 69) / 12);

      keys.push({
        note: fullNote,
        frequency: Math.round(frequency * 100) / 100,
        type: noteName.includes('#') ? 'black' : 'white',
        midiNumber
      });
    }

    return keys;
  }, []);

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
    keyboardMapping.octaveUp();
  }, []);

  const handleOctaveDown = useCallback(() => {
    keyboardMapping.octaveDown();
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

  // The lowest octave in the piano (C2)
  const startOctave = 2;

  // Scroll to middle C on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Middle C (C4) is at octave index 2 (octaves 2,3,4), so 2*7 = 14 white keys from left
    const middleCWhiteKeyIndex = (4 - startOctave) * 7;
    const scrollTarget = middleCWhiteKeyIndex * 48 - container.clientWidth / 2 + 48;
    container.scrollLeft = Math.max(0, scrollTarget);
  }, []);

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
            const octave = parseInt(key.note.slice(-1));
            const note = key.note.slice(0, -1);
            const octaveOffset = (octave - startOctave) * 7; // 7 white keys per octave

            const positions: { [key: string]: number } = {
              'C#': 0.68,
              'D#': 1.68,
              'F#': 3.68,
              'G#': 4.68,
              'A#': 5.68,
            };

            const leftPx = (octaveOffset + (positions[note] || 0)) * 48;

            return (
              <div
                key={key.note}
                className="pointer-events-auto"
                style={{ position: 'absolute', left: `${leftPx}px`, top: '0px' }}
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
    <div className="flex flex-col gap-6">
      {/* Top controls bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRecordingToggle}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all flex items-center gap-2 text-sm tracking-wide ${
              isRecording
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-amber-400 text-slate-900 hover:bg-amber-300'
            }`}
          >
            {isRecording ? (
              <>
                <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></span>
                RECORDING
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 bg-slate-900 rounded-full"></span>
                START RECORDING
              </>
            )}
          </button>

          {playedNotes.length > 0 && (
            <button
              onClick={handleReset}
              className="px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
            >
              Clear
            </button>
          )}

          {!audioInitialized && (
            <span className="text-xs text-slate-500 italic">
              Click anywhere to enable sound
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <select
            value={keyboardLayout}
            onChange={(e) => handleKeyboardLayoutChange(e.target.value as KeyboardLayout)}
            className="px-3 py-1.5 border border-slate-600 rounded-lg bg-slate-700 text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer text-xs"
          >
            <option value="QWERTY">QWERTY</option>
            <option value="QWERTZ">QWERTZ</option>
            <option value="AZERTY">AZERTY</option>
          </select>
        </div>
      </div>

      {/* Piano keyboard */}
      <div ref={scrollContainerRef} className="w-full overflow-x-auto">
        <div className="bg-slate-700 p-4 rounded-xl shadow-2xl inline-block min-w-fit">
          {renderKeys()}
        </div>
      </div>


    </div>
  );
};

export default Piano;
