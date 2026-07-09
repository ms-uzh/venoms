DROP TABLE IF EXISTS page_terms;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS pages_fts;

CREATE TABLE pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  source_path TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  formula TEXT NOT NULL DEFAULT '',
  nominal_mass REAL,
  precursor1 REAL,
  family_json TEXT NOT NULL DEFAULT '[]',
  species_json TEXT NOT NULL DEFAULT '[]',
  level TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL DEFAULT '',
  categories_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE page_terms (
  page_slug TEXT NOT NULL,
  term_type TEXT NOT NULL,
  term_value TEXT NOT NULL,
  FOREIGN KEY (page_slug) REFERENCES pages(slug) ON DELETE CASCADE
);

CREATE INDEX idx_page_terms_type_value ON page_terms(term_type, term_value);
CREATE INDEX idx_page_terms_slug ON page_terms(page_slug);
CREATE INDEX idx_pages_kind ON pages(kind);
CREATE INDEX idx_pages_formula ON pages(formula);
CREATE INDEX idx_pages_level ON pages(level);
CREATE INDEX idx_pages_confidence ON pages(confidence);

CREATE VIRTUAL TABLE pages_fts USING fts5(
  slug UNINDEXED,
  title,
  body,
  formula,
  categories,
  tags,
  families,
  species,
  tokenize = 'porter unicode61'
);
