ALTER TABLE gallery_photos ADD COLUMN thumbnail BLOB CHECK (length(thumbnail) BETWEEN 1 AND 70000);
ALTER TABLE gallery_photos ADD COLUMN original_type TEXT CHECK (original_type IN ('image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE gallery_photos ADD COLUMN original_size INTEGER NOT NULL DEFAULT 0 CHECK (original_size BETWEEN 0 AND 8000000);

CREATE TABLE gallery_original_parts (
  league TEXT NOT NULL,
  id TEXT NOT NULL,
  part INTEGER NOT NULL CHECK (part >= 0),
  bytes BLOB NOT NULL CHECK (length(bytes) BETWEEN 1 AND 500000),
  PRIMARY KEY (league, id, part),
  FOREIGN KEY (league, id) REFERENCES gallery_photos (league, id) ON DELETE CASCADE
);
