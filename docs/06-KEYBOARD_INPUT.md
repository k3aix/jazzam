# PC Keyboard Input - Feature Documentation

## Overview

You can now play the virtual piano using your PC keyboard! This provides a faster, more natural way to play melodies compared to clicking with a mouse.

## Keyboard Layout

### One Octave Mapping

The keyboard maps to **one full octave** (12 notes: C to B) plus a few extra notes:

```
┌─────────────────────────────────────────────────────────────┐
│  BLACK KEYS (Sharps) - Top Row                              │
│   W    E       T    Y    U       O    P                     │
│  C#   D#      F#   G#   A#      C#   D#                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  WHITE KEYS - Bottom Row                                    │
│ A   S   D   F   G   H   J   K   L   ;   '   ]              │
│ C   D   E   F   G   A   B   C   D   E   F   F#             │
└─────────────────────────────────────────────────────────────┘
```

### Complete Mapping Table

| Key | Note | Type  | Description        |
|-----|------|-------|--------------------|
| A   | C4   | White | Middle C (default) |
| W   | C#4  | Black | C sharp            |
| S   | D4   | White | D                  |
| E   | D#4  | Black | D sharp            |
| D   | E4   | White | E                  |
| F   | F4   | White | F                  |
| T   | F#4  | Black | F sharp            |
| G   | G4   | White | G                  |
| Y   | G#4  | Black | G sharp            |
| H   | A4   | White | A (440 Hz)         |
| U   | A#4  | Black | A sharp            |
| J   | B4   | White | B                  |
| K   | C5   | White | C (next octave)    |
| O   | C#5  | Black | C sharp            |
| L   | D5   | White | D                  |
| P   | D#5  | Black | D sharp            |
| ;   | E5   | White | E                  |
| '   | F5   | White | F                  |
| ]   | F#5  | Black | F sharp            |

## Octave Shifting

### Change Octaves

Use **Z** and **X** keys to shift the entire keyboard up or down:

- **Z** = Octave Down (range: C2-C3 minimum)
- **X** = Octave Up (range: C6-C7 maximum)

**Example:**
- Default: A key plays C4
- Press X: A key plays C5
- Press X again: A key plays C6
- Press Z: A key plays C5
- Press Z twice: A key plays C4 (back to default)

### UI Buttons

You can also use the on-screen buttons:
- "← Octave Down (Z)"
- "Octave Up (X) →"

Current octave is displayed: **C4 - B4**

## Features

### Press and Hold
- **Press key** → Note starts playing
- **Hold key** → Note sustains
- **Release key** → Note fades out (200ms release)

Just like the mouse input!

### Monophonic Mode
- Only one note plays at a time
- New note automatically stops the previous note
- Clean transitions for melody playing

### Visual Feedback
- Each piano key shows its keyboard shortcut in **blue**
- White keys: Blue text at bottom
- Black keys: Light blue text at bottom
- Currently playing note highlights visually

### Recording Mode
Keyboard input works seamlessly with recording:
- Play freely without recording
- Click "START RECORDING"
- Play melody with keyboard
- Click "STOP & SEARCH"
- Results appear!

## How It Works

### Technical Implementation

**Keyboard Mapping Service**
```typescript
// Maps keyboard keys to piano notes
getNoteForKey('a') → 'C4'
getNoteForKey('w') → 'C#4'

// Changes octave range
octaveUp()   → A now plays C5
octaveDown() → A now plays C4
```

**Event Handling**
```typescript
// On key press
1. Check if key is mapped
2. Prevent default browser behavior
3. Get corresponding piano note
4. Play sound (same as mouse)
5. Capture note if recording

// On key release
1. Get corresponding note
2. Stop sound with release envelope
```

### Anti-Repeat Protection

Holding down a key doesn't trigger multiple notes:
```typescript
pressedKeys.current.has(key) // Already pressed? Ignore
pressedKeys.current.add(key) // Mark as pressed
```

## Usage Tips

### Playing Melodies

**For Right Hand:**
- Use the home row (A S D F G H J K L)
- Natural finger positioning
- Easy to play scales

**For Left Hand:**
- Top row for accidentals (W E T Y U)
- Quick access to sharps

### Practice Exercises

**C Major Scale:**
```
A → S → D → F → G → H → J → K
C → D → E → F → G → A → B → C
```

**Chromatic Scale:**
```
A → W → S → E → D → F → T → G → Y → H → U → J → K
C → C# → D → D# → E → F → F# → G → G# → A → A# → B → C
```

**Jazz Standard Example (First notes of "Autumn Leaves"):**
```
H → J → K → L → K → J → H → F
A → B → C → D → C → B → A → F
```

### Octave Shifting Strategy

**Low Melodies:**
- Press Z 1-2 times
- Play bass lines
- Lower register sound

**High Melodies:**
- Press X 1-2 times
- Play sopranos
- Higher register sound

**Middle Range (Default):**
- C4-C5 (middle C octave)
- Most comfortable range
- Best for most melodies

## Keyboard Shortcuts Reference

### Playing Keys
| Action | Keys |
|--------|------|
| Play notes | A-; (white keys) |
| Play sharps | W E T Y U O P (black keys) |
| Sustain note | Hold key down |
| Stop note | Release key |

### Controls
| Action | Key |
|--------|-----|
| Octave down | Z |
| Octave up | X |
| (Recording, clearing via mouse only) |

## Browser Compatibility

Works in all modern browsers:
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ⚠️ Some browser shortcuts may conflict (F11, Ctrl+T, etc.)

### Prevented Defaults

The app prevents default browser behavior for mapped keys to avoid conflicts:
- Typing in search bars
- Browser shortcuts
- Page scrolling

## Comparison: Mouse vs Keyboard

| Feature | Mouse | Keyboard |
|---------|-------|----------|
| Speed | Slower | **Faster** |
| Precision | Good | **Excellent** |
| Expressiveness | Good (hold) | **Great** (hold + quick transitions) |
| Learning curve | Immediate | Short practice needed |
| Hand position | Hovering | **Resting** (ergonomic) |
| Two-hand play | Hard | **Easy** (shift octaves) |

**Recommendation:** Use keyboard for serious playing, mouse for casual exploration.

## Visual Indicators

### On Piano Keys

Each key shows:
1. **Note name** (top, gray text): C4, D#4, etc.
2. **Keyboard shortcut** (bottom, blue text): A, W, S, etc.

**Example:**
```
┌─────────┐
│   C4    │  ← Note name
│         │
│   [A]   │  ← Keyboard key (blue)
└─────────┘
```

### Octave Display

Above the piano:
```
Current Octave: C4
Z/X to shift octaves
```

### Octave Control Buttons
```
┌──────────────┐   ┌──────────┐   ┌──────────────┐
│ ← Octave Down│   │ C4 - B4  │   │ Octave Up → │
│      (Z)     │   │          │   │     (X)      │
└──────────────┘   └──────────┘   └──────────────┘
```

## Accessibility

- **Keyboard-first design**: Full functionality without mouse
- **Visual feedback**: Clear indicators for all actions
- **Audio feedback**: Immediate sound response
- **Screen reader friendly**: Proper ARIA labels
- **No timing requirements**: Play at your own pace

## Examples

### Record "Happy Birthday" Opening
```
1. Press X (shift to C5 for higher range)
2. Click "START RECORDING"
3. Play: G G A G K J
        (keyboard: G G H G K J)
4. Click "STOP & SEARCH"
5. See results!
```

### Practice Scales

**C Major:**
```
A S D F G H J K L ; ' ]
```

**C Chromatic:**
```
A W S E D F T G Y H U J
```

## Troubleshooting

### Key Not Working?

**Check:**
1. Is audio initialized? (Click anywhere first)
2. Are you on the piano screen?
3. Is another application capturing the key?
4. Try clicking the piano first to focus it

### Wrong Octave?

**Solution:**
- Press Z/X to adjust
- Check the octave display
- Reset to C4 by clicking octave buttons

### Key Stuck (Won't Stop)?

**Solution:**
- Click the piano with mouse
- Press Escape
- Reload page

### Sound Delayed?

**Normal:**
- ~10ms latency is standard for web audio
- Much faster than you can perceive

## Future Enhancements

Possible improvements:
- [ ] Customizable key mappings
- [ ] Two-octave keyboard mode
- [ ] Velocity sensitivity (louder on fast press)
- [ ] Chord mode (polyphonic)
- [ ] MIDI keyboard support
- [ ] Sustain pedal (Spacebar?)
- [ ] Keyboard shortcuts for recording

## Summary

The PC keyboard input transforms the Jazz Melody Finder into a **real playable instrument**:

✅ Fast, natural input
✅ Visual keyboard shortcuts on keys
✅ Octave shifting (Z/X keys)
✅ Press-and-hold for expression
✅ Monophonic mode for clean melodies
✅ Seamless recording integration
✅ Full keyboard range (C2 to F#7 via octave shifting)

**Now you can play jazz melodies like a pro!** 🎹⌨️🎵

---

**Files Created:**
- `frontend/src/services/keyboardMapping.ts` (New)

**Files Modified:**
- `frontend/src/components/Piano/Piano.tsx`
- `frontend/src/components/Piano/PianoKey.tsx`
