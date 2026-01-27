# Advanced Search Algorithm

Complete guide to the fuzzy matching and confidence scoring system.

## Overview

The Jazz Melody Finder uses a sophisticated search algorithm that:
- **Tolerates user mistakes** (wrong notes, extra/missing notes)
- **Returns confidence scores** (0.0 to 1.0)
- **Requires minimum 5 intervals** for reliable matching
- **Uses Levenshtein distance** for fuzzy matching
- **Weights position** (matches at melody start score higher)

## Minimum Interval Requirement

**Requirement**: At least **5 intervals** (6 notes)

### Why 5 Intervals?

- **Reliability**: Shorter sequences have too many false positives
- **Uniqueness**: 5+ intervals provide enough musical signature
- **Error tolerance**: Allows 20% error rate (1 mistake in 5 intervals)

### Example
```
❌ Too short: [1, 1, 1]           (3 intervals)
❌ Too short: [2, 1, 5, -10]      (4 intervals)
✅ Valid:     [2, 1, 5, -10, 2]   (5 intervals)
✅ Valid:     [1, 1, 1, 2, 1, 1]  (6 intervals)
```

## Error Tolerance

**Maximum allowed errors**: 20% of query length

| Query Length | Max Errors | Examples |
|--------------|------------|----------|
| 5 intervals  | 1 error    | 4/5 must match |
| 6 intervals  | 1 error    | 5/6 must match |
| 10 intervals | 2 errors   | 8/10 must match |
| 15 intervals | 3 errors   | 12/15 must match |

### Types of Errors Handled

1. **Substitution** (wrong note)
   ```
   Query:    [1, 1, 1, 2, 1, 1]
   Standard: [1, 1, 2, 2, 1, 1]  ← One note different
   Result: ✅ Match (1 error)
   ```

2. **Insertion** (extra note)
   ```
   Query:    [1, 1, 3, 1, 2, 1, 1]
   Standard: [1, 1, 1, 2, 1, 1]     ← Extra note in query
   Result: ✅ Match (1 error)
   ```

3. **Deletion** (missing note)
   ```
   Query:    [1, 1, 2, 1, 1]
   Standard: [1, 1, 1, 2, 1, 1]  ← Missing note in query
   Result: ✅ Match (1 error)
   ```

## Confidence Scoring

Confidence ranges from **0.0** (no match) to **1.0** (perfect match).

### Formula

```
Confidence = (Accuracy × 60%) +
             (Length × 20%) +
             Position Bonus (0-15%) +
             Exact Bonus (0-10%)
```

### Factors

#### 1. Accuracy (60% weight)
```
Accuracy = 1.0 - (errors / query_length)

Examples:
  0 errors in 6 notes: 1.00 (100%)
  1 error in 6 notes:  0.83 (83%)
  2 errors in 10 notes: 0.80 (80%)
```

#### 2. Length (20% weight)
Longer queries are more reliable:
```
5 intervals:  1.0 (100%)
6+ intervals: 1.0 (100%)
```

#### 3. Position Bonus (0-15%)
Matches at melody start score higher:
```
Position 0 (start):  +15%
Position 1-4:        +10%
Position 5-9:        +5%
Position 10+:        +0%
```

#### 4. Exact Match Bonus (0-10%)
No errors at all:
```
0 errors: +10%
1+ errors: +0%
```

### Example Confidence Scores

**Scenario 1: Perfect match at melody start**
```
Query: [1, 1, 1, 2, 1, 1] (6 intervals)
Match: Position 0, 0 errors

Calculation:
  Accuracy: 1.00 × 60% = 0.60
  Length:   1.00 × 20% = 0.20
  Position: +15% = 0.15
  Exact:    +10% = 0.10
  ─────────────────────
  Total: 1.05 → capped at 1.00

Confidence: 100%
```

**Scenario 2: One error, middle of melody**
```
Query: [2, 1, 5, -10, 2, 2] (6 intervals)
Match: Position 8, 1 error

Calculation:
  Accuracy: 0.83 × 60% = 0.50
  Length:   1.00 × 20% = 0.20
  Position: +5% = 0.05
  Exact:    +0% = 0.00
  ─────────────────────
  Total: 0.75

Confidence: 75%
```

**Scenario 3: Longer query, high accuracy**
```
Query: [2, 1, 5, -10, 2, 2, 5, 0, -11, 2] (10 intervals)
Match: Position 0, 1 error

Calculation:
  Accuracy: 0.90 × 60% = 0.54
  Length:   1.00 × 20% = 0.20
  Position: +15% = 0.15
  Exact:    +0% = 0.00
  ─────────────────────
  Total: 0.89

Confidence: 89%
```

## Real-World Examples

### Test 1: Blue Monk Opening
```bash
curl -X POST http://localhost:5001/api/search \
  -H "Content-Type: application/json" \
  -d '{"intervals": [1, 1, 1, 2, 1, 1]}'
```

**Result:**
```json
{
  "success": true,
  "count": 1,
  "data": [{
    "standard": {
      "title": "blue-monk",
      "composer": "Monk"
    },
    "matchPosition": 0,
    "confidence": 0.75
  }]
}
```

### Test 2: Autumn Leaves Opening
```bash
curl -X POST http://localhost:5001/api/search \
  -H "Content-Type: application/json" \
  -d '{"intervals": [2, 1, 5, -10, 2]}'
```

**Result:**
```json
{
  "success": true,
  "count": 1,
  "data": [{
    "standard": {
      "title": "autumn-leaves"
    },
    "matchPosition": 0,
    "confidence": 0.83
  }]
}
```

### Test 3: Too Short Query
```bash
curl -X POST http://localhost:5001/api/search \
  -H "Content-Type: application/json" \
  -d '{"intervals": [1, 1, 1]}'
```

**Result:**
```json
{
  "success": false,
  "error": "Query must contain at least 5 intervals for reliable matching"
}
```

## Algorithm Details

### Levenshtein Distance

The search uses **edit distance** (Levenshtein distance) to measure similarity between interval sequences. This allows three types of edits:

1. **Insertion**: Add a note
2. **Deletion**: Remove a note
3. **Substitution**: Change a note

Each edit costs 1 point. Total cost determines match quality.

### Sliding Window Search

The algorithm scans through each standard's interval sequence:

```
Standard: [1, 1, 1, 2, 1, 1, 1, -5, 2, -2, ...]
Query:    [1, 1, 1, 2, 1, 1]

Position 0: [1, 1, 1, 2, 1, 1] ← Check here
Position 1:    [1, 1, 2, 1, 1, 1] ← And here
Position 2:       [1, 2, 1, 1, 1, -5] ← And here
...
```

Best match (lowest errors) wins.

## Customization

### Adjustable Parameters

In `SearchService.cs`:

```csharp
// Minimum intervals required
private const int MinimumIntervals = 5;

// Maximum error rate (20%)
private const double MaxErrorRate = 0.2;
```

### Frontend Request Parameters

```typescript
interface SearchRequest {
  intervals: number[];      // The melody
  minConfidence?: number;  // Default: 0.6
  maxResults?: number;      // Default: 10
}
```

## Performance

- **Average search time**: 10-30ms for 10 standards
- **Scales linearly** with number of standards
- **Efficient** for databases up to 1000+ standards

## Future Improvements

Potential enhancements:

1. **Rhythm weighting**: Account for note durations
2. **Dynamic error tolerance**: Adapt based on query complexity
3. **Transposition invariance**: Already handled via intervals
4. **Contour matching**: Shape of melody (up/down patterns)
5. **Database indexing**: For faster searches with many standards

## Tips for Best Results

1. **Play at least 6 notes** (5 intervals)
2. **Start from the beginning** of the melody
3. **Play distinctive parts** (avoid repeated notes)
4. **Take your time** (accuracy > speed)
5. **Try again** if first attempt doesn't match

## Troubleshooting

**No matches found:**
- ✓ Check you played at least 6 notes
- ✓ Try a more distinctive part of the melody
- ✓ Lower `minConfidence` threshold (try 0.4)

**Too many matches:**
- ✓ Play more notes (10+ for unique signature)
- ✓ Raise `minConfidence` threshold (try 0.8)

**Wrong matches:**
- ✓ Ensure you're playing from the melody start
- ✓ Double-check the intervals you're playing
- ✓ Add more standards to the database
