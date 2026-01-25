using System.ComponentModel.DataAnnotations;

namespace SearchService.Models;

public class SearchRequest
{
    [Required]
    [MinLength(2, ErrorMessage = "At least 2 intervals are required")]
    public int[] Intervals { get; set; } = Array.Empty<int>();

    [Range(0.0, 1.0)]
    public double MinConfidence { get; set; } = 0.6;

    [Range(1, 100)]
    public int MaxResults { get; set; } = 10;
}
