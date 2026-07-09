-- Persistent, unversioned marker table. Holds `active_version` (the content hash
-- the Worker currently reads) and `created:<hash>` timestamps used for GC.
-- The versioned search tables (pages_<hash>, page_terms_<hash>, pages_fts_<hash>)
-- are created by the seed, not by migrations.
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
