CREATE TABLE IF NOT EXISTS gallery_photos (
  league TEXT NOT NULL CHECK (league IN ('football', 'badminton')),
  id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  jpeg BLOB NOT NULL CHECK (length(jpeg) BETWEEN 1 AND 600000),
  PRIMARY KEY (league, id)
);

CREATE INDEX IF NOT EXISTS gallery_photos_by_date
  ON gallery_photos (league, created_at DESC, id DESC);
