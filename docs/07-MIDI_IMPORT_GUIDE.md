# MIDI Import Guide

Complete guide for importing jazz standards from MIDI files into the database.

## Quick Start

To import all new MIDI files from the `midi-files/standards` folder:

```bash
# From the project root
./import-midi.sh
```

Or manually:

```bash
cd backend/standards-service
npm run import-midi ../../midi-files/standards
```

## How It Works

The import system:

1. **Scans** the `midi-files/standards` folder for MIDI files
2. **Checks** the database for existing standards (by title)
3. **Skips** files that are already imported
4. **Parses** each new MIDI file to extract:
   - Melody notes from the most melodic track
   - Interval sequence (semitone differences between consecutive notes)
5. **Inserts** the interval sequence into the database

### What Gets Stored

For each jazz standard:
- **Title**: Auto-capitalized from filename
- **Composer**: Extracted from filename pattern (if available)
- **Year**: Extracted from filename pattern (if available)
- **Interval Sequence**: Array of semitone differences
- **Metadata**: Key, time signature, book source

**Important**: Only interval sequences are stored, **NOT** the original note names. This saves space and allows transposition-independent searching.

## File Naming Conventions

For best results, name your MIDI files using these patterns:

### Basic Pattern
```
title.mid
airegin.mid → "Airegin" by Unknown
```

### With Composer
```
title-composer.mid
blue-bossa-kenny-dorham.mid → "Blue Bossa" by Kenny Dorham
```

### With Year
```
title-1959.mid
giant-steps-1959.mid → "Giant Steps" (1959)
```

### Combined
```
title-composer-year.mid
my-favorite-things-john-coltrane-1960.mid
```

## Supported MIDI Formats

- `.mid` files
- `.midi` files
- Single or multi-track MIDI files
- The system automatically selects the track with the most melodic notes (C3-C6 range)

## Example Usage

### Import All New Files

```bash
./import-midi.sh
```

Output:
```
🎵 Jazz MIDI Batch Importer
============================================================
📁 Scanning folder: /Users/you/github/website/midi-files/standards

📄 Found 7 MIDI file(s):
   1. airegin.mid → "Airegin"
   2. blue-monk.mid → "Blue Monk"
   ...

📊 Checking database for existing standards...
   Database has 2 standard(s)

🆕 Found 5 new file(s) to import:
   1. Blue Monk
   2. Autumn Leaves
   ...

[1/5] Processing: Blue Monk
------------------------------------------------------------
✅ Imported successfully!
   - Notes: 55
   - Intervals: 54
   - First intervals: [1, 1, 1, 2, 1, 1, 1, -5...]

============================================================
📊 Import Summary:
   ✅ Successful: 5
   ❌ Failed: 0
```

### Verify Database

```bash
docker exec jazz-postgres psql -U jazzuser -d jazz_standards \
  -c "SELECT title, array_length(interval_sequence, 1) as intervals FROM jazz_standards;"
```

## Troubleshooting

### Database Not Running

```
❌ Database is not running!
   Please start the database with: docker-compose up -d postgres
```

**Solution**: Start the database:
```bash
docker-compose up -d postgres
```

### No MIDI Files Found

```
❌ No MIDI files found in the folder
```

**Solution**: Add `.mid` files to `midi-files/standards/` folder

### Duplicate Detection

The system compares titles (case-insensitive). If you want to re-import a file, either:
1. Delete it from the database first
2. Rename the MIDI file

### All Files Already Imported

```
✅ All MIDI files are already in the database!
```

This is normal. The system prevents duplicate imports.

## Advanced: Custom Folder

Import from a different folder:

```bash
cd backend/standards-service
npm run import-midi /path/to/other/midi/folder
```

## Database Schema

Standards are stored with this structure:

```sql
CREATE TABLE jazz_standards (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  composer VARCHAR(255),
  year INTEGER,
  key VARCHAR(10),
  time_signature VARCHAR(10) DEFAULT '4/4',
  interval_sequence INTEGER[] NOT NULL,  -- The melody!
  book_source VARCHAR(100),
  page_number INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Note**: The `original_notes` column was removed to save space. Only interval sequences are stored.

## How Intervals Work

Intervals are semitone differences between consecutive notes:

```
Notes:    C4  D4  E4  F4  G4
MIDI:     60  62  64  65  67
Intervals:   2   2   1   2
```

This allows:
- Transposition-independent searching
- Efficient storage
- Fast pattern matching

Example: Playing C-D-E will match:
- C-D-E (exact)
- D-E-F# (transposed up)
- Bb-C-D (transposed down)

## Next Steps

After importing your MIDI files:

1. **Test Search**: Open the frontend at http://localhost:3000
2. **Play Melody**: Use the virtual piano to play a few notes from a standard
3. **Record**: Click REC button and play the melody
4. **Results**: The C# Search Service will find matching standards!

## Files Reference

- **Import Script**: `/import-midi.sh`
- **Batch Importer**: `/backend/standards-service/src/scripts/batchImportMidi.ts`
- **MIDI Parser**: `/backend/standards-service/src/utils/midiParser.ts`
- **MIDI Folder**: `/midi-files/standards/`
- **Database**: PostgreSQL in Docker (port 5432)
