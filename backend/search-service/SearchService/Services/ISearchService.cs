using SearchService.Models;

namespace SearchService.Services;

public interface ISearchService
{
    Task<SearchResponse> SearchByIntervalsAsync(SearchRequest request);
}
