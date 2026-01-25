using SearchService.Models;

namespace SearchService.Services;

public interface IStandardsClient
{
    Task<List<JazzStandard>> GetAllStandardsAsync();
    Task<JazzStandard?> GetStandardByIdAsync(string id);
}
