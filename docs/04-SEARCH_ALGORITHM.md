# Search Algorithm Configuration

All settings live in `backend/search-service/SearchService/appsettings.json` under the `SearchAlgorithm` key. They can also be overridden via environment variables (e.g. `SearchAlgorithm__UseEnhancedScoring=true` in `docker-compose.prod.yml`).

---

## Basic matching

### `MinimumIntervals` (default: `5`)

The minimum number of **non-zero** intervals the user must play before a search is triggered. Repeated notes (interval = 0) don't count toward this limit.

> Example: playing 6 notes gives 5 intervals. If two of those are repeated notes (interval 0), only 3 count — below the minimum, so no search fires.

---

### `DefaultErrorTolerance` (default: `0.30`)

The fraction of intervals that are allowed to be wrong. `0.30` means up to 30% of the played notes can differ from the database and still produce a match.

> Example: playing 10 intervals with tolerance 0.30 allows up to 3 errors. If the user plays "All the Things You Are" but misses 2 notes, it still matches.

Lower values → stricter matching, fewer (but more accurate) results.
Higher values → more forgiving, more results but potentially more false positives.

---

### `DefaultMinConfidence` (default: `0.40`)

Results below this confidence score are discarded. `0.40` = 40% minimum confidence.

> Example: a match with only 2 correct intervals out of 10 would score ~20% and be hidden.

Raise this (e.g. `0.60`) to show only high-confidence results. Lower it to surface more candidates.

---

### `DefaultPitchWeight` (default: `0.6`)

In the rhythm search, pitch and rhythm are both scored. This controls how much weight goes to pitch accuracy vs rhythm accuracy. The rhythm weight is automatically `1 - PitchWeight`.

> Example: `0.6` → pitch counts 60%, rhythm 40%.
> Setting `0.9` makes rhythm almost irrelevant (useful when users tap unevenly).
> Setting `0.5` gives equal weight to pitch and rhythm.

---

### `RhythmErrorTolerance` (default: `0.35`)

Same concept as `DefaultErrorTolerance` but applied specifically to the rhythm dimension of the 2D search. A slightly higher default is intentional — rhythm is harder to tap accurately than pitch.

---

### `EnablePositionBias` (default: `false`)

When `true`, matches found near the **beginning of a song** receive a small confidence bonus (up to +15%). When `false`, all positions in the song are treated equally.

> Leave `false` for a general melody finder — users might hum a chorus or bridge, not just the intro.
> Set `true` if you expect users to always start from the beginning of the melody.

---

## Enhanced scoring

### `EnhancedScoring.Enabled` (default: `false`)

Activates a stricter pitch cost curve and a consecutive miss penalty. The original algorithm treats any pitch difference of 3+ semitones as a full error (cost = 1.0). Enhanced scoring is more graduated and applies an extra penalty when the user plays several wrong notes in a row — which is a strong signal the match is wrong, not just imprecise.

**Original pitch cost:**
| Interval difference | Cost |
|---|---|
| 0 semitones | 0.00 |
| 1–2 semitones | 0.33–0.67 |
| 3+ semitones | 1.00 |

**Enhanced pitch cost:**
| Interval difference | Cost |
|---|---|
| 0 semitones | 0.00 |
| 1 semitone | 0.20 |
| 2 semitones | 0.45 |
| 3 semitones | 0.70 |
| 4 semitones | 0.85 |
| 5+ semitones | 1.00 |

> Example: a match where every interval is off by 1 semitone would score 80% with enhanced scoring vs ~67% with original.

---

### `EnhancedScoring.ConsecutiveMissThreshold` (default: `3`)

How many consecutive large pitch errors (> 2 semitones) must occur before a penalty is applied. Only active when `UseEnhancedScoring = true`.

> Example: if the user plays 4 notes that are all more than 2 semitones away from the database entry, and threshold is 3, a penalty fires on the 3rd miss and for each additional one.

---

### `EnhancedScoring.ConsecutiveMissPenalty` (default: `0.12`)

The score penalty subtracted each time a consecutive miss run is detected. The first penalty fires when the run reaches `ConsecutiveMissThreshold`; each additional miss beyond that adds `0.5 * ConsecutiveMissPenalty`.

> Example: with threshold 3 and penalty 0.12 — 3 consecutive misses subtracts 0.12, a 4th miss subtracts another 0.06, a 5th subtracts another 0.06, etc.
> A match at 80% pitch accuracy that has a 5-note consecutive wrong run could drop to ~60%, correctly pushing it down in the results.

---

## Correction detection

### `CorrectionDetection.Enabled` (default: `false`)

> Only active for the rhythm search path — requires duration ratios, skipped for pitch-only search.

When `true`, the search pre-processes the user's input to detect and remove "wrong note + correction" pairs before matching. This handles the common case where a user accidentally hits a wrong key, realizes immediately, and plays the correct note — which would otherwise appear as two extra intervals in the query.

**Condition for detection** (all three must be true):
1. The wrong note step is small: `|interval[i]| ≤ CorrectionMaxWidth`
2. The wrong note was held briefly: `duration[i] ≤ CorrectionMaxDuration`
3. The next interval reverses direction: `interval[i]` and `interval[i+1]` have opposite signs

When detected, the two intervals are merged: `interval[i] + interval[i+1]`.

> Example:
> User intended to play: `5, 2, -4`
> User actually played:   `5, 3, -1, -4` (hit a note 3 semitones up by mistake, quickly corrected)
> With `CorrectionMaxWidth = 3` and a short duration on the wrong note → detected and merged back to `5, 2, -4`.

Note: correction detection requires duration ratios, so it only activates for the rhythm search path (not pitch-only fallback). For sequences at or above `MaxSequenceLength`, only the original sequence is used — Levenshtein handles noise well enough at that length.

---

### `CorrectionDetection.MaxSequenceLength` (default: `10`)

Candidate generation only runs when the sequence has **fewer** intervals than this value. For longer sequences, Levenshtein absorbs a correction pair as 2 errors without meaningfully hurting the right song's ranking.

> Set lower (e.g. `8`) to be more conservative. Set higher (e.g. `14`) to extend the benefit to longer sequences at the cost of more search variants.

---

### `CorrectionDetection.MaxCorrectionRate` (default: `0.20`)

The maximum fraction of the sequence that can be correction pairs. Caps how many variants are generated.

> `0.20` over 8 intervals = at most 1 correction pair (floor(8 × 0.20) = 1).
> `0.20` over 9 intervals = at most 1 correction pair (floor(9 × 0.20) = 1).
> `0.25` over 8 intervals = at most 2 correction pairs.

More candidate pairs means more combinations searched. With 3 candidate positions and max 2 removals: `C(3,1) + C(3,2)` = 6 extra sequences. All fast in absolute terms.

---

### `CorrectionDetection.MaxWidth` (default: `2`)

The maximum absolute semitone distance of the accidental wrong step. A "fat finger" correction is usually only 1–2 semitones away. Larger values catch more corrections but risk merging intentional notes.

> `2` → only catches very close wrong notes (one or two keys away)
> `3` → also catches notes a minor third away (as in the example above)

---

### `CorrectionDetection.MaxDuration` (default: `4`)

The maximum duration ratio for the wrong note to be considered "quick". Duration ratios are stored in units of quarter-notes × 4:

| Value | Note value |
|---|---|
| 2 | eighth note |
| 3 | dotted eighth |
| 4 | quarter note |
| 6 | dotted quarter |
| 8 | half note |

A correction note would typically be held for an eighth note or less. The default of `4` (quarter note) is generous — lower it to `2` for stricter detection.

> `2` → only catches very fast corrections (eighth note or shorter)
> `4` → catches corrections up to a quarter note long (default)
