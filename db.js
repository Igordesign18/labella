const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(path.join(UPLOADS_DIR, 'products'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'hero'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'banners'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'videos', 'products'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, 'videos', 'site'), { recursive: true });

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
    video_url TEXT,
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

CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    whatsapp TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    feature_video_url TEXT,
    feature_video_title TEXT,
    color_primary TEXT,
    color_secondary TEXT,
    color_cta TEXT,
    theme_mode TEXT,
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

// Migração segura: adiciona colunas novas em bancos que já existiam antes
// desta versão (ALTER TABLE só roda se a coluna ainda não existir).
function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = columns.some((c) => c.name === column);
    if (!exists) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

ensureColumn('products', 'video_url', 'TEXT');
ensureColumn('products', 'image_url_2', 'TEXT');
ensureColumn('products', 'size', 'TEXT');
ensureColumn('site_config', 'feature_video_url', 'TEXT');
ensureColumn('site_config', 'feature_video_title', 'TEXT');
ensureColumn('site_config', 'theme_mode', 'TEXT');

// Garante que sempre existe uma linha de configuração (linha única, como no site_config antigo).
const configRow = db.prepare('SELECT id FROM site_config LIMIT 1').get();
if (!configRow) {
    db.prepare('INSERT INTO site_config (store_name) VALUES (?)').run('Selá');
}

// Preenche o hero e o banner com o texto que já está publicado no site (index.html),
// mas só nos campos que ainda estiverem vazios — nunca sobrescreve o que você já
// tiver editado pelo painel. Roda toda vez que o servidor sobe; depois da primeira
// vez que você salvar algo nesses campos, isso deixa de ter efeito.
db.prepare(`
    UPDATE site_config SET
        promo_banner  = COALESCE(promo_banner, ?),
        hero_title_1  = COALESCE(hero_title_1, ?),
        hero_title_2  = COALESCE(hero_title_2, ?),
        hero_subtitle = COALESCE(hero_subtitle, ?),
        hero_button   = COALESCE(hero_button, ?)
    WHERE id = (SELECT id FROM site_config LIMIT 1)
`).run(
    'Frete grátis em compras acima de R$299',
    'Coleção',
    'Atemporal',
    'Peças exclusivas, feitas para durar além de uma estação.',
    'Ver coleção'
);

module.exports = { db, DATA_DIR, UPLOADS_DIR };
