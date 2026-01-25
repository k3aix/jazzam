using System.Text.Json;
using System.Text.Json.Serialization;
using SearchService.Models;

namespace SearchService.Services;

public class StandardsClient : IStandardsClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<StandardsClient> _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public StandardsClient(HttpClient httpClient, ILogger<StandardsClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }

    public async Task<List<JazzStandard>> GetAllStandardsAsync()
    {
        try
        {
            _logger.LogInformation("Fetching all standards from Standards Service");

            var response = await _httpClient.GetAsync("/api/standards");
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            var apiResponse = JsonSerializer.Deserialize<StandardsApiResponse>(content, _jsonOptions);

            if (apiResponse?.Success == true && apiResponse.Data != null)
            {
                _logger.LogInformation("Successfully fetched {Count} standards", apiResponse.Data.Count);
                return apiResponse.Data;
            }

            _logger.LogWarning("Standards Service returned unsuccessful response");
            return new List<JazzStandard>();
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to fetch standards from Standards Service");
            throw new Exception("Unable to connect to Standards Service", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while fetching standards");
            throw;
        }
    }

    public async Task<JazzStandard?> GetStandardByIdAsync(string id)
    {
        try
        {
            _logger.LogInformation("Fetching standard {Id} from Standards Service", id);

            var response = await _httpClient.GetAsync($"/api/standards/{id}");
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            var apiResponse = JsonSerializer.Deserialize<StandardApiResponse>(content, _jsonOptions);

            if (apiResponse?.Success == true && apiResponse.Data != null)
            {
                _logger.LogInformation("Successfully fetched standard {Title}", apiResponse.Data.Title);
                return apiResponse.Data;
            }

            _logger.LogWarning("Standard {Id} not found", id);
            return null;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to fetch standard {Id} from Standards Service", id);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while fetching standard {Id}", id);
            return null;
        }
    }

    // Response DTOs for Standards Service API
    private class StandardsApiResponse
    {
        public bool Success { get; set; }
        public int Count { get; set; }
        public List<JazzStandard> Data { get; set; } = new();
    }

    private class StandardApiResponse
    {
        public bool Success { get; set; }
        public JazzStandard? Data { get; set; }
    }
}
