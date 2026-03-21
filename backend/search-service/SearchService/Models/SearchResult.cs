namespace SearchService.Models;

public class SearchResult
{
    public JazzStandard Standard { get; set; } = new();
    public int MatchPosition { get; set; }
    public int MatchLength { get; set; }
    public double Confidence { get; set; }
    public double? PitchConfidence { get; set; }
    public double? RhythmConfidence { get; set; }
    public double? CombinedConfidence { get; set; }
}

public class SearchResponse
{
    public bool Success { get; set; }
    public int Count { get; set; }
    public long ExecutionTimeMs { get; set; }
    public List<SearchResult> Data { get; set; } = new();
    public string? Error { get; set; }
}
