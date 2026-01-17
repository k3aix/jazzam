-- Mock Jazz Standards Data for Testing
-- 10 fictional standards with realistic interval sequences

INSERT INTO jazz_standards (id, title, composer, year, key, time_signature, interval_sequence, original_notes, book_source, page_number) VALUES

-- 1. Mock Standard with ascending pattern (like "Somewhere Over the Rainbow" opening)
('550e8400-e29b-41d4-a716-446655440001', 'Blue Horizon', 'Miles Mock', 1959, 'C', '4/4',
 ARRAY[2, 2, 1, 2, 2, 2, 1], 'C4 D4 E4 F4 G4 A4 B4 C5', 'Mock Real Book Vol 1', 42),

-- 2. Descending chromatic pattern
('550e8400-e29b-41d4-a716-446655440002', 'Autumn Serenade', 'Bill Mock', 1945, 'G', '3/4',
 ARRAY[-1, -1, -1, -2, -1, -1, 2], 'G4 F#4 F4 E4 D4 C#4 C4 D4', 'Mock Real Book Vol 1', 15),

-- 3. Jazz bebop-style with larger intervals
('550e8400-e29b-41d4-a716-446655440003', 'Midnight Train', 'Charlie Mock', 1952, 'F', '4/4',
 ARRAY[4, -3, 2, 5, -7, 3, -2], 'F4 A4 F#4 G#4 C#5 F#4 A4 G4', 'Mock Real Book Vol 2', 78),

-- 4. Simple melodic pattern (like "Happy Birthday" rhythm)
('550e8400-e29b-41d4-a716-446655440004', 'Celebration Song', 'Traditional Mock', 1920, 'D', '3/4',
 ARRAY[2, -2, 3, 2, 2, -1], 'D4 E4 D4 G4 A4 B4 A4', 'Mock Real Book Vol 1', 8),

-- 5. Modal jazz pattern
('550e8400-e29b-41d4-a716-446655440005', 'Sunset Boulevard', 'John Mock', 1963, 'Dm', '4/4',
 ARRAY[2, 1, 2, 2, 1, 2, 2], 'D4 E4 F4 G4 A4 Bb4 C5 D5', 'Mock Real Book Vol 3', 105),

-- 6. Latin jazz rhythm pattern
('550e8400-e29b-41d4-a716-446655440006', 'Samba Nights', 'Antonio Mock', 1968, 'Am', '4/4',
 ARRAY[2, 2, -1, -1, 3, -2, 2], 'A4 B4 C#5 C5 B4 D5 C5 D5', 'Mock Real Book Vol 2', 134),

-- 7. Ballad with small intervals
('550e8400-e29b-41d4-a716-446655440007', 'Whisper in the Dark', 'Sarah Mock', 1955, 'Eb', '4/4',
 ARRAY[1, 1, 1, -1, -1, 2, -1], 'Eb4 F4 Gb4 G4 Gb4 F4 G4 Gb4', 'Mock Real Book Vol 1', 67),

-- 8. Up-tempo swing pattern
('550e8400-e29b-41d4-a716-446655440008', 'Fast Lane', 'Duke Mock', 1942, 'Bb', '4/4',
 ARRAY[3, 2, -1, 4, -3, 2, -2], 'Bb4 D5 E5 Eb5 G5 E5 F#5 E5', 'Mock Real Book Vol 3', 23),

-- 9. Repetitive pattern (like "Take Five")
('550e8400-e29b-41d4-a716-446655440009', 'Five Times', 'Dave Mock', 1961, 'Ebm', '5/4',
 ARRAY[2, -2, 2, -2, 2, -2, 2], 'Eb4 F4 Eb4 F4 Eb4 F4 Eb4 F4', 'Mock Real Book Vol 2', 92),

-- 10. Complex bebop line
('550e8400-e29b-41d4-a716-446655440010', 'Bird Flight', 'Charlie Mock Jr', 1957, 'C', '4/4',
 ARRAY[4, 3, -2, -1, 5, -3, 2, -4], 'C4 E4 G4 F4 E4 A4 F#4 G#4 E4', 'Mock Real Book Vol 1', 156);

-- Verify insertion
SELECT COUNT(*) as total_standards FROM jazz_standards;

-- Display sample of inserted data
SELECT title, composer, key, interval_sequence FROM jazz_standards LIMIT 5;
