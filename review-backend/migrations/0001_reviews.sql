CREATE TABLE item_status (
  doc TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (doc, item_id)
);

CREATE TABLE item_notes (
  doc TEXT NOT NULL,
  item_id TEXT NOT NULL,
  id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doc, item_id, id)
);

CREATE TABLE item_scores (
  doc TEXT NOT NULL,
  item_id TEXT NOT NULL,
  voter TEXT NOT NULL,
  fun INTEGER NOT NULL,
  clear INTEGER NOT NULL,
  cost INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (doc, item_id, voter)
);

CREATE TABLE interaction_reviews (
  doc TEXT NOT NULL DEFAULT 'interaction' CHECK (doc = 'interaction'),
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  status TEXT,
  comment TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  tag TEXT,
  created_at TEXT NOT NULL
);
