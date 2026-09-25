-- Raj clone: knowledge base, retrieval index, logs, keys, limits.
-- Timestamps are unix epoch milliseconds.

CREATE TABLE sources (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('resume', 'profile', 'interview', 'note', 'correction')),
  visibility   TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  title        TEXT NOT NULL,
  topic        TEXT,
  anchor       TEXT,
  body         TEXT NOT NULL,
  meta         TEXT,
  content_hash TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_sources_kind ON sources (kind);
CREATE INDEX idx_sources_topic ON sources (topic);

CREATE TABLE chunks (
  id              TEXT PRIMARY KEY,
  source_id       TEXT NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  ord             INTEGER NOT NULL,
  text            TEXT NOT NULL,
  embedding       BLOB,
  embedding_model TEXT,
  token_estimate  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_chunks_source ON chunks (source_id);

CREATE VIRTUAL TABLE chunks_fts USING fts5 (
  text,
  content = 'chunks',
  content_rowid = 'rowid',
  tokenize = 'porter unicode61'
);

CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
CREATE TRIGGER chunks_au AFTER UPDATE OF text ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunks_fts (rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TABLE meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO meta (key, value, updated_at) VALUES ('corpus_version', '0', 0);

CREATE TABLE chat_logs (
  id          TEXT PRIMARY KEY,
  channel     TEXT NOT NULL CHECK (channel IN ('web', 'terminal', 'mcp', 'studio')),
  kind        TEXT NOT NULL DEFAULT 'ask' CHECK (kind IN ('ask', 'fit')),
  client_id   TEXT NOT NULL,
  key_id      TEXT,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  citations   TEXT NOT NULL DEFAULT '[]',
  retrieved   TEXT NOT NULL DEFAULT '[]',
  provider    TEXT,
  model       TEXT,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  latency_ms  INTEGER NOT NULL DEFAULT 0,
  guarded     INTEGER NOT NULL DEFAULT 0,
  flagged     INTEGER NOT NULL DEFAULT 0,
  correction_source_id TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_chat_logs_created ON chat_logs (created_at DESC);
CREATE INDEX idx_chat_logs_key ON chat_logs (key_id);

CREATE TABLE api_keys (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  prefix        TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  daily_limit   INTEGER NOT NULL DEFAULT 500,
  created_at    INTEGER NOT NULL,
  revoked_at    INTEGER,
  last_used_at  INTEGER,
  use_count     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rate_limits (
  bucket       TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

CREATE TABLE usage_daily (
  day        TEXT PRIMARY KEY,
  requests   INTEGER NOT NULL DEFAULT 0,
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0
);
