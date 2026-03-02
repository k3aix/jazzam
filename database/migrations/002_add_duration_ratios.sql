-- Jazz Melody Finder Database Schema
-- Migration: 002 - Add Duration Ratios for Rhythm Matching

-- Add duration_ratios column to jazz_standards
-- Stores quantized IOI (Inter-Onset Interval) ratios with x4 factor:
-- quarter=4, eighth=2, half=8, dotted-quarter=6, whole=16, etc.
ALTER TABLE jazz_standards ADD COLUMN IF NOT EXISTS duration_ratios INTEGER[];

-- Add duration_ratios to melody_queries for analytics
ALTER TABLE melody_queries ADD COLUMN IF NOT EXISTS duration_ratios INTEGER[];
