-- users
CREATE TABLE users (
  id                   TEXT PRIMARY KEY,      -- UUID or random string
  username             TEXT UNIQUE NOT NULL,
  password_hash        TEXT NOT NULL,
  salt                 TEXT NOT NULL,
  is_admin             INTEGER NOT NULL DEFAULT 0,
  must_change_password INTEGER NOT NULL DEFAULT 0,  -- 1 if user must change password on next login
  created_at           INTEGER NOT NULL
);

-- Sessions for authenticated users
CREATE TABLE sessions (
  token        TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Public sharing links for files/folders
CREATE TABLE share_links (
  id             TEXT PRIMARY KEY,
  token          TEXT UNIQUE NOT NULL,     -- random token for URL
  created_by     TEXT NOT NULL,            -- user who created the link
  r2_bucket      TEXT NOT NULL,            -- bucket binding name
  r2_path        TEXT NOT NULL,            -- full path to file/folder
  is_directory   INTEGER NOT NULL DEFAULT 0,
  password_hash  TEXT,                     -- optional password (NULL = no password)
  salt           TEXT,                     -- salt for password
  expires_at     INTEGER,                  -- optional expiration timestamp (NULL = never)
  max_downloads  INTEGER,                  -- optional download limit (NULL = unlimited)
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
