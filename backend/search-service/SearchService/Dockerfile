# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

COPY SearchService.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish

# Stage 2: Run
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 5001

# Listen on all interfaces (not just localhost)
ENV ASPNETCORE_URLS=http://+:5001

ENTRYPOINT ["dotnet", "SearchService.dll"]
