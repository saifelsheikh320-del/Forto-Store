DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  old_price REAL,
  quantity INTEGER DEFAULT 0,
  category TEXT,
  colors TEXT DEFAULT '[]', -- JSON Array
  sizes TEXT DEFAULT '[]', -- JSON Array
  images TEXT DEFAULT '[]', -- JSON Array
  image TEXT,
  description TEXT,
  archived INTEGER DEFAULT 0, -- 0: Visible, 1: Archived
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_archived ON products(archived);
