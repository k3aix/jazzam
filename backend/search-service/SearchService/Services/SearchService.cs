using System.Diagnostics;
using SearchService.Models;

namespace SearchService.Services;

public class SearchService : ISearchService
{
    private readonly IStandardsClient _standardsClient;
    private readonly ILogger<SearchService> _logger;

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

            // Fetch all standards from the Standards Service
            var allStandards = await _standardsClient.GetAllStandardsAsync();
            _logger.LogInformation("Retrieved {Count} standards for matching", allStandards.Count);

            // Perform interval matching
            var results = new List<SearchResult>();

            foreach (var standard in allStandards)
            {
                var match = FindSubsequence(standard.IntervalSequence, request.Intervals);

                if (match != null)
                {
                    var confidence = CalculateConfidence(
                        match.MatchLength,
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
                    }
                }
            }

            // Sort by confidence (highest first) and limit results
            var sortedResults = results
                .OrderByDescending(r => r.Confidence)
                .Take(request.MaxResults)
                .ToList();

            stopwatch.Stop();

            _logger.LogInformation(
                "Search completed in {ElapsedMs}ms, found {Count} matches",
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
    /// Find a subsequence within a larger sequence.
    /// Returns the position and length of the match, or null if not found.
    /// </summary>
    private SubsequenceMatch? FindSubsequence(int[] haystack, int[] needle)
    {
        if (needle.Length > haystack.Length)
        {
            return null;
        }

        // Try to find exact match first
        for (int i = 0; i <= haystack.Length - needle.Length; i++)
        {
            bool matches = true;
            for (int j = 0; j < needle.Length; j++)
            {
                if (haystack[i + j] != needle[j])
                {
                    matches = false;
                    break;
                }
            }

            if (matches)
            {
                return new SubsequenceMatch
                {
                    Position = i,
                    MatchLength = needle.Length
                };
            }
        }

        // If no exact match, try fuzzy matching (allow 1 difference)
        for (int i = 0; i <= haystack.Length - needle.Length; i++)
        {
            int differences = 0;
            for (int j = 0; j < needle.Length; j++)
            {
                if (haystack[i + j] != needle[j])
                {
                    differences++;
                    if (differences > 1)
                    {
                        break;
                    }
                }
            }

            if (differences <= 1)
            {
                return new SubsequenceMatch
                {
                    Position = i,
                    MatchLength = needle.Length
                };
            }
        }

        return null;
    }

    /// <summary>
    /// Calculate confidence score based on match quality.
    /// </summary>
    private double CalculateConfidence(int matchLength, int queryLength, int standardLength)
    {
        // Perfect match of entire query = 1.0
        double matchRatio = (double)matchLength / queryLength;

        // Bonus for matching a significant portion of the standard
        double coverageBonus = Math.Min((double)matchLength / standardLength, 0.2);

        double confidence = Math.Min(matchRatio + coverageBonus, 1.0);

        return Math.Round(confidence, 2); // Round to 2 decimals
    }

    private class SubsequenceMatch
    {
        public int Position { get; set; }
        public int MatchLength { get; set; }
    }
}
