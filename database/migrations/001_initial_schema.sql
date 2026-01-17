-- Jazz Melody Finder Database Schema
-- Migration: 001 - Initial Schema

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jazz Standards Table
CREATE TABLE IF NOT EXISTS jazz_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    composer VARCHAR(255),
    year INTEGER,
    key VARCHAR(10),
    time_signature VARCHAR(10) DEFAULT '4/4',
    interval_sequence INTEGER[] NOT NULL,  -- Array of semitone intervals
    original_notes VARCHAR(500),           -- Optional: original melody notation
    book_source VARCHAR(100),              -- Which Real Book (e.g., "Real Book Vol 1")
    page_number INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_interval_sequence ON jazz_standards USING GIN (interval_sequence);
CREATE INDEX IF NOT EXISTS idx_title ON jazz_standards (title);
CREATE INDEX IF NOT EXISTS idx_composer ON jazz_standards (composer);

-- Full-text search index on title and composer
CREATE INDEX IF NOT EXISTS idx_fulltext_search ON jazz_standards
    USING GIN (to_tsvector('english', title || ' ' || COALESCE(composer, '')));

-- User Queries Table (for analytics and debugging)
CREATE TABLE IF NOT EXISTS melody_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100),
    notes_played VARCHAR(255),
    interval_sequence INTEGER[],
    query_timestamp TIMESTAMP DEFAULT NOW(),
    results_found INTEGER DEFAULT 0,
    execution_time_ms INTEGER
);

-- Index for query analytics
CREATE INDEX IF NOT EXISTS idx_query_timestamp ON melody_queries (query_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_session_id ON melody_queries (session_id);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_jazz_standards_updated_at
    BEFORE UPDATE ON jazz_standards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE jazz_standards IS 'Stores jazz standard melodies as interval sequences for pattern matching';
COMMENT ON COLUMN jazz_standards.interval_sequence IS 'Array of semitone differences between consecutive notes (e.g., [2, 2, 1, -2] for C->D->E->F->Eb)';
COMMENT ON COLUMN jazz_standards.original_notes IS 'Optional: original melody in scientific notation (e.g., "C4 D4 E4 F4")';

COMMENT ON TABLE melody_queries IS 'Logs user queries for analytics and debugging';
