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
    /// Whether to give bonus points to matches found at the beginning of songs.
    /// Set to false to treat all positions equally (recommended for finding sub-melodies).
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

    /// <summary>
    /// Enhanced scoring: steeper pitch cost curve + consecutive miss penalty.
    /// Only active when EnhancedScoring.Enabled = true.
    /// </summary>
    public EnhancedScoringConfig EnhancedScoring { get; set; } = new();

    /// <summary>
    /// Correction detection: merge quick "wrong note + correction" pairs before searching.
    /// Only active when CorrectionDetection.Enabled = true.
    /// </summary>
    public CorrectionDetectionConfig CorrectionDetection { get; set; } = new();
}

/// <summary>
/// Settings for the enhanced scoring mode (steeper pitch cost + consecutive miss penalty).
/// </summary>
public class EnhancedScoringConfig
{
    /// <summary>
    /// Enable enhanced scoring. Set false to use the original algorithm.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// How many consecutive large misses (>2 semitones) trigger a penalty.
    /// </summary>
    public int ConsecutiveMissThreshold { get; set; } = 3;

    /// <summary>
    /// Score penalty subtracted each time a consecutive miss run is detected.
    /// Additional misses beyond the threshold add 0.5 * this value each.
    /// </summary>
    public double ConsecutiveMissPenalty { get; set; } = 0.12;
}

/// <summary>
/// Settings for correction detection (merge accidental wrong-note + correction pairs).
/// </summary>
public class CorrectionDetectionConfig
{
    /// <summary>
    /// Enable correction detection. Requires duration ratios (rhythm search path only).
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// Max absolute semitone distance of the wrong note step to be considered a correction.
    /// Default 2 = only catches very close wrong notes (one or two keys away).
    /// </summary>
    public int MaxWidth { get; set; } = 2;

    /// <summary>
    /// Max duration ratio (x4 units) for the wrong note to be considered "quick".
    /// 2 = eighth note, 4 = quarter note (default), 6 = dotted quarter.
    /// </summary>
    public int MaxDuration { get; set; } = 4;

    /// <summary>
    /// Only generate correction candidates when the sequence has fewer than this many intervals.
    /// For longer sequences Levenshtein absorbs a couple of errors without much confidence loss.
    /// </summary>
    public int MaxSequenceLength { get; set; } = 10;

    /// <summary>
    /// Maximum fraction of the sequence that can be correction pairs (0.0–1.0).
    /// E.g. 0.20 over 10 intervals = at most 2 correction pairs considered.
    /// </summary>
    public double MaxCorrectionRate { get; set; } = 0.20;
}
