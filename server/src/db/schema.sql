CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  happened_at   TEXT NOT NULL,
  type          TEXT NOT NULL,
  summary       TEXT,
  chips         TEXT,
  location      TEXT,
  trigger       TEXT,
  intensity     INTEGER,
  duration_min  INTEGER,
  coping        TEXT,
  outcome       TEXT,
  caregiver     TEXT,
  napped        INTEGER,
  month_age     INTEGER,
  photo_id      TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_time ON events(happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

CREATE TABLE IF NOT EXISTS quotes (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  context     TEXT,
  note        TEXT,
  said_at     TEXT NOT NULL,
  month_age   INTEGER NOT NULL,
  photo_id    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_quotes_month ON quotes(month_age DESC, said_at DESC);

-- 阶段三：相册
CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  taken_at      TEXT NOT NULL,
  uploaded_at   TEXT NOT NULL,
  original_name TEXT,
  mime          TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  width         INTEGER,
  height        INTEGER,
  month_age     INTEGER,
  note          TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_taken ON photos(taken_at DESC);

-- 阶段三：技能地图目录
CREATE TABLE IF NOT EXISTS skills (
  id            TEXT PRIMARY KEY,
  domain        TEXT NOT NULL,
  label         TEXT NOT NULL,
  emoji         TEXT,
  typical_from  INTEGER,
  typical_to    INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_custom     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_skills_domain ON skills(domain, sort_order);

-- 技能掌握标记（无行 = 未观察）
CREATE TABLE IF NOT EXISTS skill_marks (
  skill_id    TEXT PRIMARY KEY,
  status      TEXT NOT NULL,
  marked_at   TEXT NOT NULL,
  note        TEXT,
  updated_at  TEXT,
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

-- AI 咨询会话（消息以 JSON 存，便于整段读写）
CREATE TABLE IF NOT EXISTS ai_chats (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  messages    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_updated ON ai_chats(updated_at DESC);
