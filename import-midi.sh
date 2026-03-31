#!/bin/bash

# Jazz Melody Finder - MIDI Batch Importer
# Runs inside the Docker network so it can reach jazz-postgres directly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   🎵 Jazz Melody Finder - MIDI Batch Importer        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if PostgreSQL container is running
echo "🔍 Checking database connection..."
if ! docker exec jazz-postgres psql -U jazzuser -d jazz_standards -c "SELECT 1" > /dev/null 2>&1; then
    echo "❌ Database is not running!"
    echo "   Please start the containers first."
    exit 1
fi
echo "✅ Database is running"
echo ""

# Pass through --force flag if provided
FORCE_FLAG=""
if [[ "$*" == *"--force"* ]]; then
    FORCE_FLAG="--force"
fi

echo "🚀 Starting MIDI import process..."
echo ""

docker run --rm \
  --network jazz-network \
  -v "$SCRIPT_DIR/backend/standards-service:/app" \
  -v /app/node_modules \
  -v "$SCRIPT_DIR/midi-files:/midi-files" \
  -w /app \
  -e DB_HOST=jazz-postgres \
  -e DB_PORT=5432 \
  -e DB_USER=jazzuser \
  -e DB_PASSWORD=jazzpass123 \
  -e DB_NAME=jazz_standards \
  node:20-alpine \
  sh -c "npm install --silent && npx ts-node src/scripts/batchImportMidi.ts /midi-files/standards $FORCE_FLAG"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✨ Import completed successfully!"
    echo ""
else
    echo ""
    echo "⚠️  Import completed with errors (exit code: $EXIT_CODE)"
    echo ""
fi

exit $EXIT_CODE
