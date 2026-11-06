-- Job hopping dashboard schema

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL            -- JSON-encoded value
);

-- One row per opportunity. `list` decides which section it appears in:
--   active  = in a selection process (shown on the pipeline board)
--   pending = introduced by an agent, not answered yet
--   closed  = finished (rejected / declined / withdrawn)
CREATE TABLE applications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list        TEXT NOT NULL CHECK (list IN ('active', 'pending', 'closed')),
  company     TEXT NOT NULL,
  position    TEXT NOT NULL DEFAULT '',
  label       TEXT,               -- short name used in charts / KPI notes
  ref         TEXT,               -- job id at the agency
  stage       TEXT,               -- one of settings.stages (active only)
  status      TEXT NOT NULL DEFAULT 'wait'
              CHECK (status IN ('wait', 'good', 'risk', 'todo', 'closed')),
  agent       TEXT,
  salary_min  INTEGER,            -- 10k JPY (万円)
  salary_max  INTEGER,
  salary_text TEXT,
  fit         TEXT,
  next_action TEXT,
  since       TEXT,
  received    TEXT,               -- date the introduction was received
  deadline    TEXT,               -- YYYY-MM-DD reply deadline
  note        TEXT,
  result      TEXT,               -- closed only
  link        TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX applications_list ON applications (list, sort);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,       -- "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX events_at ON events (at DESC);

CREATE TABLE todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT NOT NULL,
  who        TEXT NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
