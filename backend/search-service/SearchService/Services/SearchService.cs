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

            // Sort by confidence (highest first), then by position (earlier is better)
            var sortedResults = results
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
    }
}
