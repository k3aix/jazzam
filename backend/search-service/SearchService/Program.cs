using SearchService.Models;
using SearchService.Services;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel - use ASPNETCORE_URLS if set, otherwise localhost:5001
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.ConfigureKestrel(serverOptions =>
    {
        serverOptions.ListenLocalhost(5001);
    });
}

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
        var isProduction = builder.Environment.IsProduction();
        if (isProduction)
        {
            // In production, nginx proxies all requests — browser never hits this service directly
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        }
        else
        {
            policy.WithOrigins("http://localhost:3000", "http://localhost:3002")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
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

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Warning()
    .MinimumLevel.Override("SearchService.Controllers", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File(
        path: "/app/logs/search-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

builder.Logging.ClearProviders();
builder.Host.UseSerilog();

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
