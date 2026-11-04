-- Inactive until seasonArchives.beta is populated by an explicit freeze.
-- These guards also protect archived data from older Worker/client versions.
CREATE TRIGGER IF NOT EXISTS gsl_beta_archive_immutable
BEFORE UPDATE OF data ON league
WHEN OLD.id = 'main'
 AND json_type(OLD.data, '$.seasonArchives.beta') = 'object'
 AND json_extract(NEW.data, '$.seasonArchives.beta') IS NOT json_extract(OLD.data, '$.seasonArchives.beta')
BEGIN
 SELECT RAISE(ABORT, 'BETA_ARCHIVE_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS gsl_beta_matches_immutable
BEFORE UPDATE OF data ON league
WHEN OLD.id = 'main'
 AND json_type(OLD.data, '$.seasonArchives.beta') = 'object'
 AND (
  (SELECT json_group_array(json(value)) FROM json_each(NEW.data, '$.matches')
   WHERE julianday(json_extract(value, '$.time')) < julianday('2026-11-02T00:00:00+08:00'))
  IS NOT
  (SELECT json_group_array(json(value)) FROM json_each(OLD.data, '$.matches')
   WHERE julianday(json_extract(value, '$.time')) < julianday('2026-11-02T00:00:00+08:00'))
 )
BEGIN
 SELECT RAISE(ABORT, 'BETA_MATCHES_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS gsl_beta_league_no_delete
BEFORE DELETE ON league
WHEN OLD.id = 'main' AND json_type(OLD.data, '$.seasonArchives.beta') = 'object'
BEGIN
 SELECT RAISE(ABORT, 'BETA_ARCHIVE_LOCKED');
END;
