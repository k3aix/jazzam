using Microsoft.AspNetCore.Mvc;
using SearchService.Models;
using SearchService.Services;

namespace SearchService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchController> _logger;

    public SearchController(ISearchService searchService, ILogger<SearchController> logger)
    {
        _searchService = searchService;
        _logger = logger;
    }

    /// <summary>
    /// Search for jazz standards by interval sequence
    /// </summary>
    /// <param name="request">Search request with intervals and parameters</param>
    /// <returns>List of matching jazz standards with confidence scores</returns>
    [HttpPost]
    [ProducesResponseType(typeof(SearchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SearchResponse>> SearchByIntervals([FromBody] SearchRequest request)
    {
        if (!ModelState.IsValid)
        {
            _logger.LogWarning("Invalid search request received");
            return BadRequest(new SearchResponse
            {
                Success = false,
                Count = 0,
                ExecutionTimeMs = 0,
                Data = new List<SearchResult>(),
                Error = "Invalid request parameters"
            });
        }

        _logger.LogInformation(
            "Search: intervals=[{Intervals}]",
            string.Join(", ", request.Intervals)
        );

        var response = await _searchService.SearchByIntervalsAsync(request);

        if (!response.Success)
        {
            return BadRequest(response);
        }

        for (int i = 0; i < response.Data.Count; i++)
        {
            var r = response.Data[i];
            _logger.LogInformation(
                "  #{Rank} {Title} — {Confidence:P0}",
                i + 1, r.Standard.Title, r.Confidence);
        }

        return Ok(response);
    }

    /// <summary>
    /// Search for jazz standards by interval sequence combined with rhythm (duration ratios)
    /// </summary>
    [HttpPost("rhythm")]
    [ProducesResponseType(typeof(SearchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SearchResponse>> SearchByRhythm([FromBody] RhythmSearchRequest request)
    {
        if (!ModelState.IsValid)
        {
            _logger.LogWarning("Invalid rhythm search request received");
            return BadRequest(new SearchResponse
            {
                Success = false,
                Count = 0,
                ExecutionTimeMs = 0,
                Data = new List<SearchResult>(),
                Error = "Invalid request parameters"
            });
        }

        _logger.LogInformation(
            "RhythmSearch: intervals=[{Intervals}] ratios=[{Ratios}]",
            string.Join(", ", request.Intervals),
            string.Join(", ", request.DurationRatios)
        );

        var response = await _searchService.SearchByRhythmAsync(request);

        if (!response.Success)
        {
            return BadRequest(response);
        }

        for (int i = 0; i < response.Data.Count; i++)
        {
            var r = response.Data[i];
            _logger.LogInformation(
                "  #{Rank} {Title} — {Confidence:P0} (pitch {Pitch:P0}, rhythm {Rhythm:P0})",
                i + 1, r.Standard.Title, r.Confidence,
                r.PitchConfidence ?? 0, r.RhythmConfidence ?? 0);
        }

        return Ok(response);
    }

    /// <summary>
    /// User confirmation feedback - logs which standard the user confirmed as correct
    /// </summary>
    [HttpPost("feedback")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult SubmitFeedback([FromBody] FeedbackRequest request)
    {
        _logger.LogInformation(
            "FEEDBACK: confirmed=\"{Title}\" (id={Id}) confidence={Confidence:P1} intervals=[{Intervals}] ratios=[{Ratios}]",
            request.Title,
            request.StandardId,
            request.Confidence,
            string.Join(", ", request.Intervals ?? Array.Empty<int>()),
            string.Join(", ", request.DurationRatios ?? Array.Empty<int>())
        );
        return Ok(new { success = true });
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult HealthCheck()
    {
        return Ok(new
        {
            service = "Search Service",
            status = "healthy",
            timestamp = DateTime.UtcNow
        });
    }
}
