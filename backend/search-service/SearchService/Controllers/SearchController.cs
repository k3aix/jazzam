using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SearchService.Models;
using SearchService.Services;

namespace SearchService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly ISearchService _searchService;
    private readonly ILogger<SearchController> _logger;
    private readonly SearchAlgorithmConfig _config;

    public SearchController(ISearchService searchService, ILogger<SearchController> logger, IOptions<SearchAlgorithmConfig> config)
    {
        _searchService = searchService;
        _logger = logger;
        _config = config.Value;
    }

    private string GetClientContext()
    {
        var ua = Request.Headers["User-Agent"].ToString();
        var country = Request.Headers["CF-IPCountry"].FirstOrDefault() ?? "??";

        string browser;
        string device;

        if (ua.Contains("OPR/") || ua.Contains("Opera")) browser = "Opera";
        else if (ua.Contains("Edg/")) browser = "Edge";
        else if (ua.Contains("Vivaldi")) browser = "Vivaldi";
        else if (ua.Contains("Firefox/")) browser = "Firefox";
        else if (ua.Contains("Chrome/") && !ua.Contains("Chromium")) browser = "Chrome";
        else if (ua.Contains("Safari/") && !ua.Contains("Chrome")) browser = "Safari";
        else if (ua.Contains("Chromium/")) browser = "Chromium";
        else browser = "Unknown";

        // CF-Device-Type correctly identifies iPads (iPadOS 13+ sends Desktop UA)
        var cfDevice = Request.Headers["CF-Device-Type"].FirstOrDefault() ?? "";
        if (ua.Contains("iPhone")) device = "iPhone";
        else if (ua.Contains("iPad") || cfDevice == "tablet") device = "iPad";
        else if (ua.Contains("Android") || cfDevice == "mobile") device = "Android";
        else if (cfDevice == "desktop") device = "Desktop";
        else device = "Desktop";

        return $"[{country} | {browser} | {device}]";
    }

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
            "Search {Context}: intervals=[{Intervals}]",
            GetClientContext(),
            string.Join(", ", request.Intervals)
        );

        var response = await _searchService.SearchByIntervalsAsync(request);

        if (!response.Success)
            return BadRequest(response);

        for (int i = 0; i < response.Data.Count; i++)
        {
            var r = response.Data[i];
            var seg = r.Standard.IntervalSequence.Skip(r.MatchPosition).Take(r.MatchLength);
            _logger.LogInformation(
                "  #{Rank} {Title} — {Confidence:P0} (pos {Position}, len {Length}) db=[{Seg}]",
                i + 1, r.Standard.Title, r.Confidence, r.MatchPosition, r.MatchLength,
                string.Join(", ", seg));
        }

        return Ok(response);
    }

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
            "RhythmSearch {Context} [{Algo}]: intervals=[{Intervals}] ratios=[{Ratios}]",
            GetClientContext(),
            _config.EnhancedScoring.Enabled ? "enhanced" : "original",
            string.Join(", ", request.Intervals),
            string.Join(", ", request.DurationRatios)
        );

        var response = await _searchService.SearchByRhythmAsync(request);

        if (!response.Success)
            return BadRequest(response);

        for (int i = 0; i < response.Data.Count; i++)
        {
            var r = response.Data[i];
            var seg = r.Standard.IntervalSequence.Skip(r.MatchPosition).Take(r.MatchLength);
            var ratSeg = r.Standard.DurationRatios?.Skip(r.MatchPosition).Take(r.MatchLength);
            _logger.LogInformation(
                "  #{Rank} {Title} — {Confidence:P0} (pitch {Pitch:P0}, rhythm {Rhythm:P0}) pos {Position} db=[{Seg}] ratios=[{Rat}]",
                i + 1, r.Standard.Title, r.Confidence,
                r.PitchConfidence ?? 0, r.RhythmConfidence ?? 0,
                r.MatchPosition,
                string.Join(", ", seg),
                ratSeg != null ? string.Join(", ", ratSeg) : "-");
        }

        return Ok(response);
    }

    [HttpPost("feedback")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult SubmitFeedback([FromBody] FeedbackRequest request)
    {
        _logger.LogInformation(
            "FEEDBACK {Context}: confirmed=\"{Title}\" (id={Id}) confidence={Confidence:P1}",
            GetClientContext(), request.Title, request.StandardId, request.Confidence);
        _logger.LogInformation(
            "  played:   intervals=[{Intervals}] ratios=[{Ratios}]",
            string.Join(", ", request.Intervals ?? Array.Empty<int>()),
            string.Join(", ", request.DurationRatios ?? Array.Empty<int>()));
        _logger.LogInformation(
            "  db match: intervals=[{DbIntervals}] at note {Position} (len {Length})",
            string.Join(", ", request.MatchedDbIntervals ?? Array.Empty<int>()),
            request.MatchPosition ?? -1,
            request.MatchLength ?? 0);
        return Ok(new { success = true });
    }

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
