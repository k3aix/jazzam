namespace SearchService.Models;

/// <summary>
/// Configuration options for the search algorithm matching behavior
/// </summary>
public class SearchAlgorithmConfig
{
    /// <summary>
    /// Minimum number of intervals required for a valid search query
    /// </summary>
    public int MinimumIntervals { get; set; } = 5;

    /// <summary>
    /// Default error tolerance (0.0 to 1.0) - percentage of allowed errors
    /// Example: 0.3 = allow up to 30% of notes to be wrong
    /// </summary>
    public double DefaultErrorTolerance { get; set; } = 0.3;

    /// <summary>
    /// Default minimum confidence score for results (0.0 to 1.0)
    /// </summary>
    public double DefaultMinConfidence { get; set; } = 0.4;

    /// <summary>
    /// Whether to give bonus points to matches found at the beginning of songs
    /// Set to false to treat all positions equally (recommended for finding sub-melodies)
    /// </summary>
    public bool EnablePositionBias { get; set; } = false;

    /// <summary>
    /// Weight given to pitch matching in combined rhythm search (0.0 to 1.0).
    /// Rhythm weight = 1 - PitchWeight.
    /// </summary>
    public double DefaultPitchWeight { get; set; } = 0.6;

    /// <summary>
    /// Error tolerance for rhythm matching (0.0 to 1.0)
    /// </summary>
    public double RhythmErrorTolerance { get; set; } = 0.35;
}
