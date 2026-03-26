import { useState } from 'react';
import { PianoKey as PianoKeyType } from '../../types';

interface PianoKeyProps {
  keyData: PianoKeyType;
  onNoteStart: (note: string, frequency: number) => void;
  onNoteEnd: (note: string) => void;
  isActive?: boolean;
  keyboardKey?: string | null;
}

const PianoKey: React.FC<PianoKeyProps> = ({
  keyData,
  onNoteStart,
  onNoteEnd,
  isActive = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = () => {
    if (!isPressed) {
      setIsPressed(true);
      onNoteStart(keyData.note, keyData.frequency);
    }
  };

  const handleMouseUp = () => {
    if (isPressed) {
      setIsPressed(false);
      onNoteEnd(keyData.note);
    }
  };

  const handleMouseLeave = () => {
    if (isPressed) {
      setIsPressed(false);
      onNoteEnd(keyData.note);
    }
  };

  // Styling based on key type (white/black) and state
  const baseClasses = keyData.type === 'white'
    ? 'w-12 h-40 border-2 border-gray-800 rounded-b-lg relative shadow-md'
    : 'w-7 h-28 border-2 border-black rounded-b-lg shadow-lg';

  const whiteKeyColor = isPressed || isActive
    ? 'bg-gradient-to-b from-blue-400 to-blue-500 shadow-inner'
    : 'bg-white hover:bg-gray-100';

  const blackKeyColor = isPressed || isActive
    ? 'bg-gradient-to-b from-blue-400 to-blue-600 shadow-inner'
    : 'bg-gradient-to-b from-gray-800 to-gray-950 hover:from-gray-700 hover:to-gray-900';

  const colorClasses = keyData.type === 'white' ? whiteKeyColor : blackKeyColor;

  return (
    <div
      className={`${baseClasses} ${colorClasses} cursor-pointer transition-all duration-150 select-none flex items-end justify-center pb-2`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      role="button"
      aria-label={`Piano key ${keyData.note}`}
      tabIndex={0}
    >
      </div>
  );
};

export default PianoKey;
