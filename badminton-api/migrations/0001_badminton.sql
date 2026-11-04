-- Additive migration: no changes to table-football league or photos.
CREATE TABLE IF NOT EXISTS badminton_league (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  revision INTEGER NOT NULL DEFAULT 0
);
