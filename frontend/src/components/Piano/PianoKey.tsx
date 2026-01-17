import { useState } from 'react';
import { PianoKey as PianoKeyType } from '../../types';

interface PianoKeyProps {
  keyData: PianoKeyType;
  onNoteStart: (note: string, frequency: number) => void;
  onNoteEnd: (note: string) => void;
  isActive?: boolean;
  keyboardKey?: string | null; // Keyboard shortcut to display
}

const PianoKey: React.FC<PianoKeyProps> = ({
  keyData,
  onNoteStart,
  onNoteEnd,
  isActive = false,
  keyboardKey = null
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
    ? 'w-12 h-40 border-2 border-gray-800 rounded-b-lg relative'
    : 'w-8 h-24 bg-gray-900 border-2 border-black rounded-b-lg absolute -ml-4 z-10';

  const whiteKeyColor = isPressed || isActive
    ? 'bg-blue-300'
    : 'bg-white hover:bg-gray-100';

  const blackKeyColor = isPressed || isActive
    ? 'bg-blue-600'
    : 'bg-gray-900 hover:bg-gray-700';

  const colorClasses = keyData.type === 'white' ? whiteKeyColor : blackKeyColor;

  const textColor = keyData.type === 'white'
    ? 'text-gray-600 text-xs'
    : 'text-white text-xs';

  return (
    <div
      className={`${baseClasses} ${colorClasses} cursor-pointer transition-colors duration-75 select-none flex items-end justify-center pb-2`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      role="button"
      aria-label={`Piano key ${keyData.note}`}
      tabIndex={0}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className={textColor}>{keyData.note}</span>
        {keyboardKey && (
          <span className={`text-xs font-bold ${keyData.type === 'white' ? 'text-blue-500' : 'text-blue-300'}`}>
            {keyboardKey}
          </span>
        )}
      </div>
    </div>
  );
};

export default PianoKey;
