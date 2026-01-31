#!/bin/bash

# Jazz Melody Finder - MIDI Batch Importer
# This script automatically imports new MIDI files from midi-files/standards folder

set -e

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   🎵 Jazz Melody Finder - MIDI Batch Importer        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if PostgreSQL is running
echo "🔍 Checking database connection..."
if ! docker exec jazz-postgres psql -U jazzuser -d jazz_standards -c "SELECT 1" > /dev/null 2>&1; then
    echo "❌ Database is not running!"
    echo "   Please start the database with: docker-compose up -d postgres"
    exit 1
fi
echo "✅ Database is running"
echo ""

# Navigate to standards-service directory
cd backend/standards-service

# Run the batch import
echo "🚀 Starting MIDI import process..."
echo ""
npm run import-midi ../../midi-files/standards

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
