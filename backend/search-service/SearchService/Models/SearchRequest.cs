using System.ComponentModel.DataAnnotations;

namespace SearchService.Models;

public class SearchRequest
{
    [Required]
    [MinLength(2, ErrorMessage = "At least 2 intervals are required")]
    public int[] Intervals { get; set; } = Array.Empty<int>();

    [Range(0.0, 1.0)]
    public double MinConfidence { get; set; } = 0.4;

    [Range(1, 100)]
    public int MaxResults { get; set; } = 10;

    /// <summary>
    /// Error tolerance: percentage of allowed errors (0.0 to 1.0).
    /// Example: 0.3 = allow up to 30% of notes to be wrong.
    /// Default: 0.3 (30% error tolerance)
    /// </summary>
    [Range(0.0, 1.0)]
    public double ErrorTolerance { get; set; } = 0.3;
}

public class RhythmSearchRequest
{
    [Required]
    [MinLength(2, ErrorMessage = "At least 2 intervals are required")]
    public int[] Intervals { get; set; } = Array.Empty<int>();

    [Required]
    [MinLength(2, ErrorMessage = "At least 2 duration ratios are required")]
    public int[] DurationRatios { get; set; } = Array.Empty<int>();

    [Range(0.0, 1.0)]
    public double PitchWeight { get; set; } = 0.6;

    [Range(0.0, 1.0)]
    public double MinConfidence { get; set; } = 0.4;

    [Range(1, 100)]
    public int MaxResults { get; set; } = 10;

    [Range(0.0, 1.0)]
    public double ErrorTolerance { get; set; } = 0.3;
}
