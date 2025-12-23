-- users
CREATE TABLE users (
  id            TEXT PRIMARY KEY,      -- UUID or random string
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

-- groups
CREATE TABLE groups (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);

-- user <-> group (many-to-many)
CREATE TABLE user_groups (
  user_id  TEXT NOT NULL,
  group_id TEXT NOT NULL,
  PRIMARY KEY (user_id, group_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (group_id) REFERENCES groups(id)
);

-- "shares" are logical roots/prefixes in R2
CREATE TABLE shares (
  id           TEXT PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,      -- e.g. "team-photos"
  r2_bucket    TEXT NOT NULL,
  r2_prefix    TEXT NOT NULL,             -- e.g. "team-photos/"
  owner_user_id TEXT NOT NULL,
  quota_bytes  INTEGER,                   -- NULL = unlimited
  created_at   INTEGER NOT NULL
);

-- ACLs per share (can be per user, per group, or "everyone")
CREATE TABLE share_grants (
  share_id     TEXT NOT NULL,
  subject_type TEXT NOT NULL, -- 'user' | 'group' | 'all'
  subject_id   TEXT,          -- NULL for 'all'
  permission   TEXT NOT NULL, -- 'read' | 'write' | 'read_write'
  PRIMARY KEY (share_id, subject_type, subject_id),
  FOREIGN KEY (share_id) REFERENCES shares(id)
);

-- Simple usage tracking per share; add per-user later if needed
CREATE TABLE share_usage (
  share_id     TEXT PRIMARY KEY,
  used_bytes   INTEGER NOT NULL DEFAULT 0,
  object_count INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (share_id) REFERENCES shares(id)
);

-- Sessions for authenticated users
CREATE TABLE sessions (
  token        TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
