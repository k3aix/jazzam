using System.Text.Json.Serialization;

namespace SearchService.Models;

public class JazzStandard
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("composer")]
    public string? Composer { get; set; }

    [JsonPropertyName("year")]
    public int? Year { get; set; }

    [JsonPropertyName("key")]
    public string? Key { get; set; }

    [JsonPropertyName("time_signature")]
    public string TimeSignature { get; set; } = "4/4";

    [JsonPropertyName("interval_sequence")]
    public int[] IntervalSequence { get; set; } = Array.Empty<int>();

    [JsonPropertyName("duration_ratios")]
    public int[]? DurationRatios { get; set; }

    [JsonPropertyName("original_notes")]
    public string? OriginalNotes { get; set; }

    [JsonPropertyName("book_source")]
    public string? BookSource { get; set; }

    [JsonPropertyName("page_number")]
    public int? PageNumber { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
