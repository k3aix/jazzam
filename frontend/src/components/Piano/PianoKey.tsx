import { useState, useRef } from 'react';
import { PianoKey as PianoKeyType } from '../../types';

interface PianoKeyProps {
  keyData: PianoKeyType;
  onNoteStart: (note: string, frequency: number) => void;
  onNoteEnd: (note: string) => void;
  isActive?: boolean;
  keyboardKey?: string | null;
  onScrollStart?: (clientX: number) => void;
}

const SCROLL_THRESHOLD = 10; // px horizontal movement to trigger scroll instead of note

const PianoKey: React.FC<PianoKeyProps> = ({
  keyData,
  onNoteStart,
  onNoteEnd,
  isActive = false,
  onScrollStart,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const pointerStartX = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (!isPressed) {
      setIsPressed(true);
      onNoteStart(keyData.note, keyData.frequency);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPressed) return;
    const dx = e.clientX - pointerStartX.current;
    if (Math.abs(dx) > SCROLL_THRESHOLD) {
      // Horizontal drag — stop note, release capture, hand off to container
      setIsPressed(false);
      onNoteEnd(keyData.note);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      onScrollStart?.(e.clientX);
    }
  };

  const handlePointerUp = () => {
    if (isPressed) {
      setIsPressed(false);
      onNoteEnd(keyData.note);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    // Only stop if pointer was not captured (i.e. not actively pressing)
    if (isPressed && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      setIsPressed(false);
      onNoteEnd(keyData.note);
    }
  };

  const baseClasses = keyData.type === 'white'
    ? 'w-12 h-40 border-2 border-gray-800 rounded-b-lg relative shadow-md'
    : 'w-7 h-28 border-2 border-black rounded-b-lg shadow-lg';

  const whiteKeyColor = isPressed || isActive
    ? 'bg-gradient-to-b from-amber-300 to-amber-400 shadow-inner'
    : 'bg-white hover:bg-gray-100';

  const blackKeyColor = isPressed || isActive
    ? 'bg-gradient-to-b from-amber-400 to-amber-600 shadow-inner'
    : 'bg-gradient-to-b from-gray-800 to-gray-950 hover:from-gray-700 hover:to-gray-900';

  const colorClasses = keyData.type === 'white' ? whiteKeyColor : blackKeyColor;

  return (
    <div
      className={`${baseClasses} ${colorClasses} cursor-pointer transition-colors duration-75 select-none touch-none`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      role="button"
      aria-label={`Piano key ${keyData.note}`}
    >
    </div>
  );
};

export default PianoKey;
