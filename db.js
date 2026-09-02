const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(path.join(UPLOADS_DIR, 'products'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'hero'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'labella.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    visible INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    image_url TEXT,
    old_price REAL,
    new_price REAL,
    discount_percentage INTEGER DEFAULT 0,
    sold_out INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_name TEXT,
    promo_banner TEXT,
    free_shipping_value REAL,
    newsletter_discount INTEGER,
    hero_title_1 TEXT,
    hero_title_2 TEXT,
    hero_subtitle TEXT,
    hero_button TEXT,
    hero_image TEXT,
    color_primary TEXT,
    color_secondary TEXT,
    color_cta TEXT,
    whatsapp TEXT,
    phone TEXT,
    email TEXT,
    city TEXT,
    state TEXT,
    working_hours TEXT,
    facebook TEXT,
    instagram TEXT,
    pinterest TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Garante que sempre existe uma linha de configuração (linha única, como no site_config antigo)
const configRow = db.prepare('SELECT id FROM site_config LIMIT 1').get();
if (!configRow) {
    db.prepare('INSERT INTO site_config (store_name) VALUES (?)').run('Labella Woman');
}

module.exports = { db, DATA_DIR, UPLOADS_DIR };
