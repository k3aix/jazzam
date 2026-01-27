using System.Diagnostics;
using SearchService.Models;

namespace SearchService.Services;

public class SearchService : ISearchService
{
    private readonly IStandardsClient _standardsClient;
    private readonly ILogger<SearchService> _logger;

    // Minimum intervals required for a valid search (prevents short, unreliable queries)
    private const int MinimumIntervals = 5;

    // Maximum allowed error rate (20% of query length)
    private const double MaxErrorRate = 0.2;

    public SearchService(IStandardsClient standardsClient, ILogger<SearchService> logger)
    {
        _standardsClient = standardsClient;
        _logger = logger;
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
            if (request.Intervals.Length < MinimumIntervals)
            {
                _logger.LogWarning(
                    "Query too short: {Count} intervals (minimum: {Min})",
                    request.Intervals.Length,
                    MinimumIntervals
                );

                return new SearchResponse
                {
                    Success = false,
                    Count = 0,
                    ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                    Data = new List<SearchResult>(),
                    Error = $"Query must contain at least {MinimumIntervals} intervals for reliable matching"
                };
            }

            // Fetch all standards from the Standards Service
            var allStandards = await _standardsClient.GetAllStandardsAsync();
            _logger.LogInformation("Retrieved {Count} standards for matching", allStandards.Count);

            // Perform interval matching with fuzzy logic
            var results = new List<SearchResult>();

            foreach (var standard in allStandards)
            {
                var match = FindBestMatch(standard.IntervalSequence, request.Intervals);

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
    /// Allows for small mistakes in user input (wrong notes, extra notes, missing notes).
    /// </summary>
    private FuzzyMatch? FindBestMatch(int[] haystack, int[] needle)
    {
        if (needle.Length > haystack.Length)
        {
            return null;
        }

        FuzzyMatch? bestMatch = null;
        int maxAllowedErrors = (int)Math.Ceiling(needle.Length * MaxErrorRate);

        // Scan through the standard's interval sequence
        for (int i = 0; i <= haystack.Length - needle.Length; i++)
        {
            // Calculate Levenshtein distance for this window
            var errors = CalculateLevenshteinDistance(
                haystack.Skip(i).Take(needle.Length + maxAllowedErrors).ToArray(),
                needle
            );

            if (errors <= maxAllowedErrors)
            {
                int matchLength = Math.Min(needle.Length, haystack.Length - i);

                // Weight matches at the beginning of the melody higher
                double positionWeight = i == 0 ? 1.1 : (i < 5 ? 1.05 : 1.0);
                double score = (1.0 - (double)errors / needle.Length) * positionWeight;

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
    /// </summary>
    private double CalculateConfidence(FuzzyMatch match, int queryLength, int standardLength)
    {
        // Base confidence: inverse of error rate
        double accuracyScore = 1.0 - ((double)match.ErrorCount / queryLength);

        // Length factor: longer matches are more reliable
        double lengthFactor = Math.Min(queryLength / (double)MinimumIntervals, 1.0);

        // Position bonus: matches at the beginning of a melody are more significant
        double positionBonus = match.Position == 0 ? 0.15 :
                              match.Position < 5 ? 0.10 :
                              match.Position < 10 ? 0.05 : 0.0;

        // Exact match bonus
        double exactBonus = match.ErrorCount == 0 ? 0.1 : 0.0;

        // Combined confidence
        double confidence = (accuracyScore * 0.6) + // 60% weight on accuracy
                           (lengthFactor * 0.2) +   // 20% weight on length
                           positionBonus +          // Up to 15% position bonus
                           exactBonus;              // 10% exact match bonus

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
