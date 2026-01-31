using SearchService.Models;
using SearchService.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to listen on port 5001
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenLocalhost(5001);
});

// Configure search algorithm settings
builder.Services.Configure<SearchAlgorithmConfig>(
    builder.Configuration.GetSection("SearchAlgorithm"));

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Jazz Search Service", Version = "v1" });
});

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:3002")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Configure HttpClient for Standards Service
var standardsServiceUrl = builder.Configuration["StandardsService:BaseUrl"] ?? "http://localhost:3001";
builder.Services.AddHttpClient<IStandardsClient, StandardsClient>(client =>
{
    client.BaseAddress = new Uri(standardsServiceUrl);
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Register application services
builder.Services.AddScoped<ISearchService, SearchService.Services.SearchService>();

// Add logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");

app.UseAuthorization();

app.MapControllers();

// Root endpoint
app.MapGet("/", () => new
{
    service = "Jazz Melody Finder - Search Service",
    version = "1.0.0",
    status = "running",
    endpoints = new
    {
        health = "GET /api/search/health",
        search = "POST /api/search"
    }
});

Console.WriteLine(@"
╔════════════════════════════════════════════════════════╗
║   🎵 Jazz Melody Finder - Search Service (C#)        ║
╟────────────────────────────────────────────────────────╢
║   Server running on: http://localhost:5001            ║
║   Environment: Development                            ║
║   Standards Service: {0,-33}║
╚════════════════════════════════════════════════════════╝
", standardsServiceUrl);

app.Run();
