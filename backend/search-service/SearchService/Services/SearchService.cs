using System.Diagnostics;
using Microsoft.Extensions.Options;
using SearchService.Models;

namespace SearchService.Services;

public class SearchService : ISearchService
{
    private readonly IStandardsClient _standardsClient;
    private readonly ILogger<SearchService> _logger;
    private readonly SearchAlgorithmConfig _config;

    public SearchService(
        IStandardsClient standardsClient,
        ILogger<SearchService> logger,
        IOptions<SearchAlgorithmConfig> config)
    {
        _standardsClient = standardsClient;
        _logger = logger;
        _config = config.Value;
    }

    public async Task<SearchResponse> SearchByIntervalsAsync(SearchRequest request)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            _logger.LogInformation(
                "Searching for melody with {Count} intervals: [{Intervals}]",
                request.Intervals.Length,
                string.Join(", ", request.Intervals)
            );

            // Validate minimum interval length (using filtered length, excluding zeros)
            var filteredIntervals = request.Intervals.Where(x => x != 0).ToArray();
            if (filteredIntervals.Length < _config.MinimumIntervals)
            {
                _logger.LogWarning(
                    "Query too short: {Count} intervals after removing zeros (minimum: {Min})",
                    filteredIntervals.Length,
                    _config.MinimumIntervals
                );

                return new SearchResponse
                {
                    Success = false,
                    Count = 0,
                    ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                    Data = new List<SearchResult>(),
                    Error = $"Query must contain at least {_config.MinimumIntervals} distinct pitch changes (repeated notes don't count)"
                };
            }

            // Fetch all standards from the Standards Service
            var allStandards = await _standardsClient.GetAllStandardsAsync();
            _logger.LogInformation("Retrieved {Count} standards for matching", allStandards.Count);

            // Perform interval matching with fuzzy logic
            var results = new List<SearchResult>();

            foreach (var standard in allStandards)
            {
                var match = FindBestMatch(
                    standard.IntervalSequence,
                    request.Intervals,
                    request.ErrorTolerance
                );

                if (match != null)
                {
                    var confidence = CalculateConfidence(
                        match,
                        request.Intervals.Length,
                        standard.IntervalSequence.Length
                    );

                    if (confidence >= request.MinConfidence)
                    {
                        results.Add(new SearchResult
                        {
                            Standard = standard,
                            MatchPosition = match.Position,
                            MatchLength = match.MatchLength,
                            Confidence = confidence
                        });

                        _logger.LogDebug(
                            "Match found in '{Title}': position={Pos}, errors={Errors}, confidence={Conf:F2}",
                            standard.Title,
                            match.Position,
                            match.ErrorCount,
                            confidence
                        );
                    }
                }
            }

            // Deduplicate by title (keep best-scoring variant per song)
            var deduped = DeduplicateByTitle(results);

            // Sort by confidence (highest first), then by position (earlier is better)
            var sortedResults = deduped
                .OrderByDescending(r => r.Confidence)
                .ThenBy(r => r.MatchPosition)
                .Take(request.MaxResults)
                .ToList();

            stopwatch.Stop();

            _logger.LogInformation(
                "Search completed in {ElapsedMs}ms, found {Count} matches (from {Total} standards)",
                stopwatch.ElapsedMilliseconds,
                sortedResults.Count,
                allStandards.Count
            );

            return new SearchResponse
            {
                Success = true,
                Count = sortedResults.Count,
                ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                Data = sortedResults
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Error during search operation");

            return new SearchResponse
            {
                Success = false,
                Count = 0,
                ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                Data = new List<SearchResult>(),
                Error = ex.Message
            };
        }
    }

    public async Task<SearchResponse> SearchByRhythmAsync(RhythmSearchRequest request)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            _logger.LogInformation(
                "2D search: {IntCount} intervals, {RatioCount} duration ratios, pitchWeight={Weight}",
                request.Intervals.Length,
                request.DurationRatios.Length,
                request.PitchWeight
            );

            var filteredIntervals = request.Intervals.Where(x => x != 0).ToArray();
            if (filteredIntervals.Length < _config.MinimumIntervals)
            {
                return new SearchResponse
                {
                    Success = false,
                    Count = 0,
                    ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                    Data = new List<SearchResult>(),
                    Error = $"Query must contain at least {_config.MinimumIntervals} distinct pitch changes"
                };
            }

            var allStandards = await _standardsClient.GetAllStandardsAsync();
            _logger.LogInformation("Retrieved {Count} standards for 2D matching", allStandards.Count);

            // Build query as 2D segments: (interval, durationRatio)
            var querySegments = BuildSegments(request.Intervals, request.DurationRatios);
            double pitchWeight = request.PitchWeight;
            double rhythmWeight = 1.0 - pitchWeight;

            var results = new List<SearchResult>();

            foreach (var standard in allStandards)
            {
                // Build standard's 2D segments
                var standardSegments = BuildSegments(
                    standard.IntervalSequence,
                    standard.DurationRatios
                );

                if (standardSegments.Length == 0) continue;

                var match = FindBestMatch2D(
                    standardSegments,
                    querySegments,
                    request.ErrorTolerance,
                    pitchWeight,
                    rhythmWeight
                );

                if (match == null) continue;

                var confidence = CalculateConfidence(
                    match,
                    querySegments.Length,
                    standardSegments.Length
                );

                if (confidence >= request.MinConfidence)
                {
                    // Use pitch score as the main confidence (pitch is primary),
                    // combined confidence stored separately for tiebreaking
                    var pitchConfidence = Math.Round(match.PitchScore, 3);
                    results.Add(new SearchResult
                    {
                        Standard = standard,
                        MatchPosition = match.Position,
                        MatchLength = match.MatchLength,
                        Confidence = pitchConfidence,
                        PitchConfidence = pitchConfidence,
                        RhythmConfidence = Math.Round(match.RhythmScore, 3),
                        CombinedConfidence = Math.Round(confidence, 3)
                    });
                }
            }

            // Deduplicate by title (keep best-scoring variant per song)
            var deduped = DeduplicateByTitle(results);

            var sortedResults = deduped
                .OrderByDescending(r => r.Confidence)
                .ThenByDescending(r => r.CombinedConfidence)
                .ThenBy(r => r.MatchPosition)
                .Take(request.MaxResults)
                .ToList();

            stopwatch.Stop();

            _logger.LogInformation(
                "2D search completed in {ElapsedMs}ms, found {Count} matches",
                stopwatch.ElapsedMilliseconds,
                sortedResults.Count
            );

            return new SearchResponse
            {
                Success = true,
                Count = sortedResults.Count,
                ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                Data = sortedResults
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Error during 2D search");

            return new SearchResponse
            {
                Success = false,
                Count = 0,
                ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                Data = new List<SearchResult>(),
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// A 2D melody segment: pitch interval + duration ratio.
    /// </summary>
    private struct MelodySegment
    {
        public int Interval;
        public int DurationRatio;
    }

    /// <summary>
    /// Build array of 2D segments from parallel interval and duration arrays.
    /// If duration ratios are missing or shorter, defaults to 0 (unknown).
    /// </summary>
    private MelodySegment[] BuildSegments(int[] intervals, int[]? durationRatios)
    {
        var segments = new MelodySegment[intervals.Length];
        for (int i = 0; i < intervals.Length; i++)
        {
            segments[i] = new MelodySegment
            {
                Interval = intervals[i],
                DurationRatio = (durationRatios != null && i < durationRatios.Length)
                    ? durationRatios[i] : 0
            };
        }
        return segments;
    }

    /// <summary>
    /// Find the best matching subsequence using unified 2D segments.
    /// Each element is a (pitch, rhythm) pair compared simultaneously.
    /// </summary>
    private FuzzyMatch? FindBestMatch2D(
        MelodySegment[] haystack, MelodySegment[] needle,
        double errorTolerance, double pitchWeight, double rhythmWeight)
    {
        // Filter out zero-interval segments from needle (repeated notes)
        var filteredNeedle = needle.Where(s => s.Interval != 0).ToArray();
        if (filteredNeedle.Length == 0) return null;

        FuzzyMatch? bestMatch = null;
        double maxAllowedDistance = filteredNeedle.Length * errorTolerance;

        for (int i = 0; i < haystack.Length; i++)
        {
            int minWindowSize = filteredNeedle.Length;
            int maxWindowSize = Math.Min(haystack.Length - i, filteredNeedle.Length * 3);

            for (int windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize++)
            {
                if (i + windowSize > haystack.Length) break;

                var window = haystack.Skip(i).Take(windowSize).ToArray();
                var filteredWindow = window.Where(s => s.Interval != 0).ToArray();

                if (Math.Abs(filteredWindow.Length - filteredNeedle.Length) > maxAllowedDistance)
                    continue;

                // Unified 2D Levenshtein
                var (distance, pitchDist, rhythmDist) = Calculate2DLevenshtein(
                    filteredWindow, filteredNeedle, pitchWeight, rhythmWeight
                );

                if (distance <= maxAllowedDistance)
                {
                    double score = 1.0 - (distance / filteredNeedle.Length);

                    if (_config.EnablePositionBias)
                    {
                        double positionBias = i == 0 ? 1.1 : (i < 5 ? 1.05 : 1.0);
                        score *= positionBias;
                    }

                    if (bestMatch == null || score > bestMatch.Score)
                    {
                        // Decompose into pitch-only and rhythm-only scores for logging
                        double maxLen = Math.Max(filteredWindow.Length, filteredNeedle.Length);
                        double pitchScore = maxLen > 0 ? 1.0 - (pitchDist / maxLen) : 0;
                        double rhythmScore = maxLen > 0 ? 1.0 - (rhythmDist / maxLen) : 0;

                        bestMatch = new FuzzyMatch
                        {
                            Position = i,
                            MatchLength = windowSize,
                            ErrorCount = (int)Math.Ceiling(distance),
                            Score = score,
                            FilteredLength = filteredNeedle.Length,
                            PitchScore = Math.Max(0, pitchScore),
                            RhythmScore = Math.Max(0, rhythmScore)
                        };
                    }
                }
            }
        }

        return bestMatch;
    }

    /// <summary>
    /// Levenshtein on 2D melody segments. Each substitution cost combines
    /// pitch distance and rhythm distance into a single cost.
    /// Returns (combinedDistance, pitchOnlyDistance, rhythmOnlyDistance).
    /// </summary>
    private (double combined, double pitch, double rhythm) Calculate2DLevenshtein(
        MelodySegment[] source, MelodySegment[] target,
        double pitchWeight, double rhythmWeight)
    {
        if (source.Length == 0) return (target.Length, target.Length, target.Length);
        if (target.Length == 0) return (source.Length, source.Length, source.Length);

        int sLen = source.Length, tLen = target.Length;
        double[,] dist = new double[sLen + 1, tLen + 1];
        double[,] pDist = new double[sLen + 1, tLen + 1]; // pitch-only tracking
        double[,] rDist = new double[sLen + 1, tLen + 1]; // rhythm-only tracking

        for (int i = 0; i <= sLen; i++) { dist[i, 0] = i; pDist[i, 0] = i; rDist[i, 0] = i; }
        for (int j = 0; j <= tLen; j++) { dist[0, j] = j; pDist[0, j] = j; rDist[0, j] = j; }

        for (int i = 1; i <= sLen; i++)
        {
            for (int j = 1; j <= tLen; j++)
            {
                // Pitch substitution cost: 0 if exact, graduated by semitone difference
                int pitchDiff = Math.Abs(source[i - 1].Interval - target[j - 1].Interval);
                double pitchCost = pitchDiff == 0 ? 0.0 : Math.Min(pitchDiff / 3.0, 1.0);

                // Rhythm substitution cost: graduated by ratio difference
                // Values are x4 (quarter=4, eighth=2, half=8, dotted-half=12, whole=16)
                // Use ratio-based comparison: how far apart are the two values proportionally
                int srcRatio = source[i - 1].DurationRatio;
                int tgtRatio = target[j - 1].DurationRatio;
                double rhythmCost;
                if (srcRatio == 0 || tgtRatio == 0)
                    rhythmCost = 0.0; // Unknown rhythm, don't penalize
                else
                {
                    // Proportional distance: e.g., 12 vs 8 = ratio 1.5, 32 vs 8 = ratio 4.0
                    double ratio = (double)Math.Max(srcRatio, tgtRatio) / Math.Min(srcRatio, tgtRatio);
                    if (ratio <= 1.0) rhythmCost = 0.0;         // exact match
                    else if (ratio <= 1.5) rhythmCost = 0.15;   // e.g., 8 vs 6 (half vs dotted-quarter)
                    else if (ratio <= 2.0) rhythmCost = 0.35;   // e.g., 8 vs 4 (half vs quarter)
                    else if (ratio <= 3.0) rhythmCost = 0.65;   // e.g., 12 vs 4 (dotted-half vs quarter)
                    else rhythmCost = 1.0;                      // very different durations
                }

                // Combined cost: weighted sum of both dimensions
                double substCost = (pitchWeight * pitchCost) + (rhythmWeight * rhythmCost);

                // Combined distance
                double del = dist[i - 1, j] + 1.0;
                double ins = dist[i, j - 1] + 1.0;
                double sub = dist[i - 1, j - 1] + substCost;

                if (del <= ins && del <= sub)
                {
                    dist[i, j] = del;
                    pDist[i, j] = pDist[i - 1, j] + 1.0;
                    rDist[i, j] = rDist[i - 1, j] + 1.0;
                }
                else if (ins <= sub)
                {
                    dist[i, j] = ins;
                    pDist[i, j] = pDist[i, j - 1] + 1.0;
                    rDist[i, j] = rDist[i, j - 1] + 1.0;
                }
                else
                {
                    dist[i, j] = sub;
                    pDist[i, j] = pDist[i - 1, j - 1] + pitchCost;
                    rDist[i, j] = rDist[i - 1, j - 1] + rhythmCost;
                }
            }
        }

        return (dist[sLen, tLen], pDist[sLen, tLen], rDist[sLen, tLen]);
    }

    /// <summary>
    /// Remove all zeros from a sequence, focusing purely on melodic contour.
    /// Repeated notes (interval 0) are ignored as users may play different repetitions.
    /// Example: [2, 0, 0, 3, 0, 5] -> [2, 3, 5]
    /// </summary>
    private int[] RemoveZeros(int[] sequence)
    {
        return sequence.Where(x => x != 0).ToArray();
    }

    /// <summary>
    /// Count the number of zeros in a sequence.
    /// </summary>
    private int CountZeros(int[] sequence)
    {
        return sequence.Count(x => x == 0);
    }

    /// <summary>
    /// Calculate a small bonus based on how similar the repetition patterns are.
    /// Returns a value between 0 and 0.03 (max 3% bonus).
    /// </summary>
    private double CalculateRepetitionBonus(int[] original, int[] query)
    {
        int originalZeros = CountZeros(original);
        int queryZeros = CountZeros(query);

        // If neither has zeros, no bonus needed
        if (originalZeros == 0 && queryZeros == 0) return 0.0;

        // If counts match exactly, small bonus
        if (originalZeros == queryZeros) return 0.03;

        // If one has zeros and the other doesn't, or counts differ, no bonus (but no penalty)
        return 0.0;
    }

    /// <summary>
    /// Find the best matching subsequence using fuzzy matching with error tolerance.
    /// Allows for mistakes in user input (wrong notes, extra notes, missing notes).
    /// Removes repeated notes (interval 0) to focus on melodic contour.
    /// Searches through the ENTIRE song, treating all positions equally.
    /// </summary>
    private FuzzyMatch? FindBestMatch(int[] haystack, int[] needle, double errorTolerance)
    {
        // Remove zeros from query - focus on melodic contour only
        var filteredNeedle = RemoveZeros(needle);

        if (filteredNeedle.Length == 0)
        {
            return null;
        }

        FuzzyMatch? bestMatch = null;
        int maxAllowedErrors = (int)Math.Ceiling(filteredNeedle.Length * errorTolerance);

        _logger.LogDebug(
            "Searching with error tolerance {Tolerance:F2} (max {MaxErrors} errors for {Length} filtered intervals, original had {OrigLength} with {Zeros} zeros)",
            errorTolerance,
            maxAllowedErrors,
            filteredNeedle.Length,
            needle.Length,
            needle.Length - filteredNeedle.Length
        );

        // Scan through the standard's interval sequence using a sliding window approach
        // Windows of varying sizes are checked because zeros are removed
        for (int i = 0; i < haystack.Length; i++)
        {
            // Try different window sizes to find the best match
            // Window might be larger than filteredNeedle due to zeros in haystack
            int minWindowSize = filteredNeedle.Length;
            int maxWindowSize = Math.Min(haystack.Length - i, filteredNeedle.Length * 3); // Allow up to 3x for zeros

            for (int windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize++)
            {
                if (i + windowSize > haystack.Length) break;

                var window = haystack.Skip(i).Take(windowSize).ToArray();
                var filteredWindow = RemoveZeros(window);

                // Skip if filtered lengths are too different
                if (Math.Abs(filteredWindow.Length - filteredNeedle.Length) > maxAllowedErrors)
                    continue;

                // Calculate Levenshtein distance on zero-free sequences
                var errors = CalculateLevenshteinDistance(filteredWindow, filteredNeedle);

                if (errors <= maxAllowedErrors)
                {
                    // Score based on accuracy of filtered match
                    double score = 1.0 - ((double)errors / filteredNeedle.Length);

                    // Add small bonus for similar repetition patterns (max 3%)
                    double repetitionBonus = CalculateRepetitionBonus(window, needle);
                    score += repetitionBonus;

                    // Apply position bias only if enabled in config
                    if (_config.EnablePositionBias)
                    {
                        double positionWeight = i == 0 ? 1.1 : (i < 5 ? 1.05 : 1.0);
                        score *= positionWeight;
                    }

                    if (bestMatch == null || score > bestMatch.Score)
                    {
                        bestMatch = new FuzzyMatch
                        {
                            Position = i,
                            MatchLength = windowSize,
                            ErrorCount = errors,
                            Score = score,
                            FilteredLength = filteredNeedle.Length
                        };
                    }
                }
            }
        }

        return bestMatch;
    }

    /// <summary>
    /// Calculate Levenshtein distance (edit distance) between two sequences.
    /// This allows for insertions, deletions, and substitutions.
    /// </summary>
    private int CalculateLevenshteinDistance(int[] source, int[] target)
    {
        if (source.Length == 0) return target.Length;
        if (target.Length == 0) return source.Length;

        int[,] distance = new int[source.Length + 1, target.Length + 1];

        // Initialize first column and row
        for (int i = 0; i <= source.Length; i++)
            distance[i, 0] = i;
        for (int j = 0; j <= target.Length; j++)
            distance[0, j] = j;

        // Calculate distances
        for (int i = 1; i <= source.Length; i++)
        {
            for (int j = 1; j <= target.Length; j++)
            {
                int cost = (source[i - 1] == target[j - 1]) ? 0 : 1;

                distance[i, j] = Math.Min(
                    Math.Min(
                        distance[i - 1, j] + 1,      // deletion
                        distance[i, j - 1] + 1),     // insertion
                    distance[i - 1, j - 1] + cost    // substitution
                );
            }
        }

        return distance[source.Length, target.Length];
    }

    /// <summary>
    /// Calculate confidence score based on match quality with multiple factors.
    /// When multiple MIDI variants of the same song exist (e.g. from different books),
    /// keep only the best-scoring variant per title.
    /// </summary>
    private static List<SearchResult> DeduplicateByTitle(List<SearchResult> results)
    {
        return results
            .GroupBy(r => r.Standard.Title, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(r => r.Confidence).First())
            .ToList();
    }

    /// <summary>
    /// Position-neutral scoring - treats all positions in the song equally.
    /// Uses filtered length (zeros removed) for accuracy calculation.
    /// </summary>
    private double CalculateConfidence(FuzzyMatch match, int queryLength, int standardLength)
    {
        // Use filtered length for accuracy calculation (zeros removed)
        int effectiveLength = match.FilteredLength > 0 ? match.FilteredLength : queryLength;

        // Base confidence: inverse of error rate (primary factor)
        double accuracyScore = 1.0 - ((double)match.ErrorCount / effectiveLength);

        // Length factor: longer matches are more reliable (based on filtered length)
        double lengthFactor = Math.Min(effectiveLength / (double)_config.MinimumIntervals, 1.0);

        // Exact match bonus
        double exactBonus = match.ErrorCount == 0 ? 0.15 : 0.0;

        // Position bonus: only if enabled in configuration
        double positionBonus = 0.0;
        if (_config.EnablePositionBias)
        {
            positionBonus = match.Position == 0 ? 0.15 :
                           match.Position < 5 ? 0.10 :
                           match.Position < 10 ? 0.05 : 0.0;
        }

        // Combined confidence (position-neutral by default)
        double confidence = (accuracyScore * 0.70) + // 70% weight on accuracy
                           (lengthFactor * 0.15) +   // 15% weight on length
                           exactBonus +              // 15% exact match bonus
                           positionBonus;            // 0-15% position bonus (if enabled)

        // Cap at 1.0 and ensure minimum of 0.0
        confidence = Math.Max(0.0, Math.Min(1.0, confidence));

        return Math.Round(confidence, 3); // Round to 3 decimals for precision
    }

    /// <summary>
    /// Represents a fuzzy match result with error information
    /// </summary>
    private class FuzzyMatch
    {
        public int Position { get; set; }
        public int MatchLength { get; set; }
        public int ErrorCount { get; set; }
        public double Score { get; set; }
        public int FilteredLength { get; set; } // Length after removing zeros
        public double PitchScore { get; set; }  // Pitch-only accuracy (for 2D search logging)
        public double RhythmScore { get; set; } // Rhythm-only accuracy (for 2D search logging)
    }
}
