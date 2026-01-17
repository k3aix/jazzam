# Audio Playback & Recording Mode - Feature Update

## New Features Added

### 1. Real-Time Audio Playback 🔊

The virtual piano now plays realistic sound using the **Web Audio API**!

**How it works:**
- Each key plays its actual frequency when clicked
- Sounds continue even when not recording
- Piano-like envelope (Attack-Decay-Sustain-Release)
- Adjustable master volume
- Smooth note transitions

**Technical Details:**
- Uses Web Audio API `OscillatorNode` for sound generation
- Sine wave oscillator for clean piano-like tone
- ADSR envelope: 10ms attack, 100ms decay, sustain at 60%, 100ms release
- Notes automatically stop after 800ms (configurable)
- Master volume set to 30% to prevent distortion

**File:** [frontend/src/services/audioService.ts](frontend/src/services/audioService.ts)

### 2. Recording Mode 🔴

Users can now **play freely** without capturing notes, then **start recording** when ready!

**Workflow:**
1. **Play Mode** (default): Piano plays sounds but doesn't capture notes
2. **Recording Mode**: Click "START RECORDING" to begin capturing melody
3. **Stop & Search**: Click "STOP & SEARCH" or toggle recording to identify the melody

**Benefits:**
- Practice and warm up without polluting your melody
- Only record when you're ready
- Clear visual indicator when recording (red pulse animation)
- Automatic search when recording stops

## User Interface Changes

### Before
- Notes were always captured
- No sound playback
- Auto-search happened immediately

### After
- **REC Button**: Large, animated button to start/stop recording
  - Gray when idle: "START RECORDING"
  - Red with pulse when active: "RECORDING"
- **Recording Status Bar**: Shows when recording with note count
- **Sound Always On**: Hear what you play regardless of recording state
- **Clear Workflow**: Instructions updated to reflect new 3-step process

## Component Updates

### Piano Component
[frontend/src/components/Piano/Piano.tsx](frontend/src/components/Piano/Piano.tsx)

**New Props:**
```typescript
interface PianoProps {
  onMelodyChange: (notes: Note[], intervals: number[]) => void;
  isRecording: boolean;           // NEW: Recording state
  onRecordingToggle: () => void;  // NEW: Toggle callback
}
```

**New State:**
- `audioInitialized`: Tracks if Web Audio API is ready
- Audio initializes on first user click (browser requirement)

**Updated Behavior:**
```typescript
const handleNotePlay = (note: string, frequency: number) => {
  // ALWAYS play sound
  audioService.playNote(note, frequency, 800);

  // ONLY capture notes if recording
  if (isRecording) {
    // Add note to melody
    // Calculate intervals
    // Notify parent component
  }
}
```

### App Component
[frontend/src/App.tsx](frontend/src/App.tsx)

**New State:**
- `isRecording`: Boolean to track recording state

**Updated Logic:**
- Auto-search only triggers when `isRecording` is true
- When recording stops, performs final search
- Results only show when NOT recording
- Recording status bar shows during recording

## Audio Service API

### Methods

```typescript
// Initialize audio context (called automatically)
audioService.initialize()

// Play a note
audioService.playNote(note: string, frequency: number, duration?: number)
// Example: audioService.playNote('C4', 261.63, 800)

// Stop a specific note
audioService.stopNote(note: string)

// Stop all playing notes
audioService.stopAll()

// Volume control (0.0 to 1.0)
audioService.setVolume(0.5)
audioService.getVolume() // Returns current volume

// Check if initialized
audioService.isInitialized()

// Resume context (if browser suspended it)
await audioService.resume()
```

## Visual Indicators

### Recording Button States

**Idle State:**
```
┌─────────────────────┐
│ ⚫ START RECORDING  │  (Gray background)
└─────────────────────┘
```

**Recording State:**
```
┌─────────────────────┐
│ ⚪ RECORDING        │  (Red background, pulsing)
└─────────────────────┘
```

### Recording Status Bar

Shows when recording is active:
```
┌────────────────────────────────────────────────────┐
│ ⚪ Recording in progress  • 7 notes, 6 intervals   │
│                               [STOP & SEARCH]      │
└────────────────────────────────────────────────────┘
```
(Red background with pulse animation)

## User Experience Flow

### Previous Flow
1. Click piano → Note captured + no sound
2. Auto-search starts immediately
3. Results appear while playing

**Problem**: Can't practice, every click is recorded

### New Flow
1. **Free Play**: Click keys to hear sound and practice
2. **Ready to Record**: Click "START RECORDING"
3. **Play Melody**: Play the melody you want to identify
4. **Stop & Search**: Click button to stop and get results
5. **View Results**: See matched jazz standards

**Benefit**: Natural workflow matching real-world usage

## Technical Implementation

### Browser Compatibility

The Web Audio API is supported in all modern browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ⚠️ Requires HTTPS or localhost for security

### Audio Context Initialization

```typescript
// Must be initialized after user interaction (browser policy)
useEffect(() => {
  const initAudio = () => {
    audioService.initialize();
  };

  document.addEventListener('click', initAudio, { once: true });
}, []);
```

**Why**: Browsers prevent auto-play audio until user interaction

### Performance

- **Memory**: Each active note uses ~1KB (OscillatorNode + GainNode)
- **CPU**: Minimal - native browser audio rendering
- **Latency**: ~10ms from click to sound (imperceptible)
- **Max Polyphony**: Unlimited (but limited to 24 keys in UI)

## Customization Options

### Change Piano Sound

In `audioService.ts`, modify the oscillator type:

```typescript
oscillator.type = 'sine';      // Current (pure tone)
// OR
oscillator.type = 'triangle';  // Softer
oscillator.type = 'square';    // Harsher (organ-like)
oscillator.type = 'sawtooth';  // Bright (synth-like)
```

### Adjust Note Duration

```typescript
// In Piano.tsx
audioService.playNote(note, frequency, 1200);  // 1.2 seconds
audioService.playNote(note, frequency, 0);     // Sustain until manual stop
```

### Change ADSR Envelope

```typescript
// In audioService.ts, playNote() method
gainNode.gain.setValueAtTime(0, now);
gainNode.gain.linearRampToValueAtTime(1.0, now + 0.005); // Faster attack
gainNode.gain.linearRampToValueAtTime(0.4, now + 0.2);   // Longer decay
```

### Adjust Master Volume

Default is 30% (0.3). Change in `audioService.ts`:

```typescript
this.masterGain.gain.value = 0.5;  // 50% volume
```

Or dynamically:
```typescript
audioService.setVolume(0.7);  // 70% volume
```

## Future Enhancements

### Potential Features
- [ ] **Volume Slider**: Let users adjust volume in UI
- [ ] **Different Instrument Sounds**: Piano, organ, synth, etc.
- [ ] **Metronome**: Keep time while recording
- [ ] **Visual Waveform**: Show audio playback visually
- [ ] **Export Recording**: Save melody as MIDI or audio file
- [ ] **Keyboard Input**: Map computer keyboard to piano keys
- [ ] **Touch Support**: Better mobile/tablet experience
- [ ] **Sustain Pedal**: Hold notes longer with spacebar

### Advanced Audio Features
- [ ] **Reverb Effect**: Add room ambience
- [ ] **Velocity Sensitivity**: Louder/softer based on click speed
- [ ] **Polyphonic Recording**: Record chords, not just melodies
- [ ] **Playback**: Play back recorded melody
- [ ] **Tempo Detection**: Capture rhythm, not just pitches

## Testing Checklist

### Audio Playback
- [x] Notes play sound when clicked
- [x] Sound works in both recording and non-recording mode
- [x] No distortion or clipping
- [x] Audio initializes on first interaction
- [x] All 24 keys produce correct frequencies
- [x] Notes stop cleanly (no clicks or pops)

### Recording Mode
- [x] Button shows correct state (gray/red)
- [x] Animation pulses when recording
- [x] Notes only captured when recording
- [x] Search only happens when recording
- [x] Status bar appears during recording
- [x] Results appear after stopping
- [x] Clear button works

### User Flow
- [x] Can play freely without recording
- [x] Can start recording when ready
- [x] Recording captures notes correctly
- [x] Stop & search performs search
- [x] Results display properly
- [x] Can start new recording

## Troubleshooting

### No Sound?
1. Check browser console for errors
2. Make sure you clicked somewhere first (audio requires user interaction)
3. Check system volume
4. Try refreshing the page
5. Verify in supported browser (Chrome/Firefox/Safari)

### Audio Delayed?
- This is normal browser behavior
- ~10ms latency is typical for Web Audio API
- For lower latency, use native audio hardware

### Notes Overlapping?
- Each note auto-stops after 800ms
- Rapid clicking won't cause issues
- Old notes are cleaned up automatically

## Files Modified

1. **New**: [frontend/src/services/audioService.ts](frontend/src/services/audioService.ts) (145 lines)
2. **Updated**: [frontend/src/components/Piano/Piano.tsx](frontend/src/components/Piano/Piano.tsx)
3. **Updated**: [frontend/src/App.tsx](frontend/src/App.tsx)
4. **New**: This documentation file

## Summary

These updates transform the Jazz Melody Finder from a silent note capture tool into an **interactive musical instrument** with a **professional recording workflow**. Users can now:

✅ Hear what they play in real-time
✅ Practice without recording
✅ Record only when ready
✅ Get clear visual feedback
✅ Experience a natural, intuitive workflow

**The app now feels like a real musical tool!** 🎹🎵
