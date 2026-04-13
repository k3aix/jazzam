#!/bin/bash

# Jazz Melody Finder - JSON Sequence Importer
# Imports pre-computed interval+rhythm sequences from a JSON file.
# Runs inside the Docker network so it can reach jazz-postgres directly.
#
# Usage:
#   ./import-json.sh <json-file> [--book-source <name>] [--force]
#
# Example:
#   ./import-json.sh midi-files/jazz_sequences_260413-717.json --book-source jazz-sequences-2026

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$1" ]; then
  echo "Usage: $0 <json-file> [--book-source <name>] [--force]"
  exit 1
fi

JSON_FILE="$1"
shift

# Resolve the JSON file path relative to script dir
JSON_ABS="$(cd "$(dirname "$JSON_FILE")" && pwd)/$(basename "$JSON_FILE")"
JSON_IN_CONTAINER="/json-import/$(basename "$JSON_FILE")"
JSON_DIR="$(dirname "$JSON_ABS")"

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   🎵 Jazz Melody Finder - JSON Sequence Importer     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if PostgreSQL container is running
echo "🔍 Checking database connection..."
if ! docker exec jazz-postgres psql -U jazzuser -d jazz_standards -c "SELECT 1" > /dev/null 2>&1; then
    echo "❌ Database is not running! Please start the containers first."
    exit 1
fi
echo "✅ Database is running"
echo ""

echo "📄 File: $JSON_ABS"
echo "🚀 Starting import..."
echo ""

docker run --rm \
  --network jazz-network \
  -v "$SCRIPT_DIR/backend/standards-service:/app" \
  -v /app/node_modules \
  -v "$JSON_DIR:/json-import" \
  -w /app \
  -e DB_HOST=jazz-postgres \
  -e DB_PORT=5432 \
  -e DB_USER=jazzuser \
  -e DB_PASSWORD=jazzpass123 \
  -e DB_NAME=jazz_standards \
  node:20-alpine \
  sh -c "npm install --silent && npx ts-node src/scripts/importJsonSequences.ts $JSON_IN_CONTAINER $*"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✨ Import completed successfully!"
else
    echo ""
    echo "⚠️  Import completed with errors (exit code: $EXIT_CODE)"
fi

exit $EXIT_CODE
