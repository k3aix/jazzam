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

            // Validate minimum interval length
            if (request.Intervals.Length < _config.MinimumIntervals)
            {
                _logger.LogWarning(
                    "Query too short: {Count} intervals (minimum: {Min})",
                    request.Intervals.Length,
                    _config.MinimumIntervals
                );

                return new SearchResponse
                {
                    Success = false,
                    Count = 0,
                    ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                    Data = new List<SearchResult>(),
                    Error = $"Query must contain at least {_config.MinimumIntervals} intervals for reliable matching"
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
    /// Find the best matching subsequence using fuzzy matching with error tolerance.
    /// Allows for mistakes in user input (wrong notes, extra notes, missing notes).
    /// Searches through the ENTIRE song, treating all positions equally.
    /// </summary>
    private FuzzyMatch? FindBestMatch(int[] haystack, int[] needle, double errorTolerance)
    {
        if (needle.Length > haystack.Length)
        {
            return null;
        }

        FuzzyMatch? bestMatch = null;
        int maxAllowedErrors = (int)Math.Ceiling(needle.Length * errorTolerance);

        _logger.LogDebug(
            "Searching with error tolerance {Tolerance:F2} (max {MaxErrors} errors for {Length} intervals)",
            errorTolerance,
            maxAllowedErrors,
            needle.Length
        );

        // Scan through the standard's interval sequence
        // This allows finding melodies anywhere in the song, not just at the beginning
        for (int i = 0; i <= haystack.Length - needle.Length; i++)
        {
            // Extract exact-length window from haystack for fair comparison
            var window = haystack.Skip(i).Take(needle.Length).ToArray();

            // Calculate Levenshtein distance between same-length sequences
            var errors = CalculateLevenshteinDistance(window, needle);

            if (errors <= maxAllowedErrors)
            {
                int matchLength = needle.Length;

                // Score based purely on accuracy (no position bias)
                double score = 1.0 - ((double)errors / needle.Length);

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
                        MatchLength = matchLength,
                        ErrorCount = errors,
                        Score = score
                    };
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
    /// </summary>
    private double CalculateConfidence(FuzzyMatch match, int queryLength, int standardLength)
    {
        // Base confidence: inverse of error rate (primary factor)
        double accuracyScore = 1.0 - ((double)match.ErrorCount / queryLength);

        // Length factor: longer matches are more reliable
        double lengthFactor = Math.Min(queryLength / (double)_config.MinimumIntervals, 1.0);

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
    }
}
