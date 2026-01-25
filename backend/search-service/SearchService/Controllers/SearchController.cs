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
            "Received search request with {Count} intervals",
            request.Intervals.Length
        );

        var response = await _searchService.SearchByIntervalsAsync(request);

        if (!response.Success)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, response);
        }

        return Ok(response);
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
