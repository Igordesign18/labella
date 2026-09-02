require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { db, UPLOADS_DIR } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'eb1358de-884a-4bc2-aba5-d4dedf0c662d';

app.use(express.json());

// ---------- Helpers ----------
function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function getColorsForProduct(productId) {
    return db.prepare('SELECT * FROM product_colors WHERE product_id = ?').all(productId);
}

function requireAdmin(req, res, next) {
    const key = req.header('x-admin-key');
    if (!key || key !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Chave de acesso inválida' });
    }
    next();
}

// ---------- Upload de imagens ----------
const IMAGE_UPLOAD_FOLDERS = { hero: 'hero', banner: 'banners' };
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = IMAGE_UPLOAD_FOLDERS[req.query.type] || 'products';
        cb(null, path.join(UPLOADS_DIR, folder));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        const prefix = IMAGE_UPLOAD_FOLDERS[req.query.type] ? `${req.query.type}-` : '';
        const name = `${prefix}${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
        cb(null, name);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, igual ao limite antigo do painel
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Arquivo precisa ser uma imagem'));
        }
        cb(null, true);
    }
});

app.post('/api/admin/upload', requireAdmin, (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        const folder = IMAGE_UPLOAD_FOLDERS[req.query.type] || 'products';
        const url = `/uploads/${folder}/${req.file.filename}`;
        res.json({ url });
    });
});

// ---------- Upload de vídeos (produto ou site, até 50MB) ----------
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = req.query.type === 'site' ? 'site' : 'products';
        cb(null, path.join(UPLOADS_DIR, 'videos', type));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.mp4';
        const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
        cb(null, name);
    }
});
const uploadVideo = multer({
    storage: videoStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('video/')) {
            return cb(new Error('Arquivo precisa ser um vídeo'));
        }
        cb(null, true);
    }
});

app.post('/api/admin/upload-video', requireAdmin, (req, res) => {
    uploadVideo.single('video')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Vídeo muito grande! Máximo 50MB' });
            }
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        const type = req.query.type === 'site' ? 'site' : 'products';
        const url = `/uploads/videos/${type}/${req.file.filename}`;
        res.json({ url });
    });
});

// ---------- Rotas públicas (usadas pelo site) ----------
app.get('/api/site-config', (req, res) => {
    const config = db.prepare('SELECT * FROM site_config ORDER BY id LIMIT 1').get();
    res.json(config || {});
});

app.get('/api/categories', (req, res) => {
    const rows = db.prepare('SELECT * FROM categories WHERE visible = 1 ORDER BY position ASC').all();
    res.json(rows);
});

app.get('/api/products', (req, res) => {
    const rows = db.prepare('SELECT * FROM products ORDER BY position ASC').all();
    res.json(rows);
});

app.get('/api/product-colors', (req, res) => {
    const rows = db.prepare('SELECT * FROM product_colors').all();
    res.json(rows);
});

app.get('/api/banners', (req, res) => {
    const rows = db.prepare('SELECT * FROM banners ORDER BY position ASC').all();
    res.json(rows);
});

// ---------- Rotas administrativas (painel) ----------
app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({ ok: true });
});

// Categorias (lista completa, incluindo ocultas)
app.get('/api/admin/categories', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM categories ORDER BY position ASC').all();
    res.json(rows);
});

app.get('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json(row);
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const { name, visible } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM categories').get();
    const position = (maxPos.maxPos || 0) + 1;

    const info = db.prepare(
        'INSERT INTO categories (name, slug, visible, position, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(name, slugify(name), visible ? 1 : 0, position);

    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

    const name = req.body.name ?? existing.name;
    const visible = req.body.visible !== undefined ? (req.body.visible ? 1 : 0) : existing.visible;
    const position = req.body.position !== undefined ? req.body.position : existing.position;
    const slug = req.body.name ? slugify(req.body.name) : existing.slug;

    db.prepare(
        'UPDATE categories SET name = ?, slug = ?, visible = ?, position = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(name, slug, visible, position, req.params.id);

    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// Banners (carrossel — máximo de 5)
const MAX_BANNERS = 5;

app.get('/api/admin/banners', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM banners ORDER BY position ASC').all();
    res.json(rows);
});

app.post('/api/admin/banners', requireAdmin, (req, res) => {
    const { image_url, link_url } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Imagem é obrigatória' });

    const count = db.prepare('SELECT COUNT(*) as total FROM banners').get();
    if (count.total >= MAX_BANNERS) {
        return res.status(400).json({ error: `Máximo de ${MAX_BANNERS} banners no carrossel` });
    }

    const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM banners').get();
    const position = (maxPos.maxPos || 0) + 1;

    const info = db.prepare(
        'INSERT INTO banners (image_url, link_url, position, updated_at) VALUES (?, ?, ?, datetime(\'now\'))'
    ).run(image_url, link_url || null, position);

    res.json(db.prepare('SELECT * FROM banners WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/banners/:id', requireAdmin, (req, res) => {
    const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Banner não encontrado' });

    const image_url = req.body.image_url ?? existing.image_url;
    const link_url = req.body.link_url !== undefined ? req.body.link_url : existing.link_url;
    const position = req.body.position !== undefined ? req.body.position : existing.position;

    db.prepare(
        'UPDATE banners SET image_url = ?, link_url = ?, position = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(image_url, link_url || null, position, req.params.id);

    res.json(db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id));
});

app.delete('/api/admin/banners/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// Produtos
app.get('/api/admin/products', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    res.json(rows);
});

app.get('/api/admin/products/:id', requireAdmin, (req, res) => {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Produto não encontrado' });
    row.colors = getColorsForProduct(row.id);
    res.json(row);
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
    const {
        name, category_id, image_url, video_url, old_price, new_price,
        discount_percentage, sold_out, colors
    } = req.body;

    if (!name || !image_url) {
        return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });
    }

    const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM products').get();
    const position = (maxPos.maxPos || 0) + 1;

    const insertProduct = db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO products
                (name, category_id, image_url, video_url, old_price, new_price, discount_percentage, sold_out, position, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            name, category_id || null, image_url, video_url || null,
            old_price || 0, new_price || 0, discount_percentage || 0,
            sold_out ? 1 : 0, position
        );

        const productId = info.lastInsertRowid;

        if (Array.isArray(colors) && colors.length > 0) {
            const insertColor = db.prepare(
                'INSERT INTO product_colors (product_id, color_name, color_hex) VALUES (?, ?, ?)'
            );
            colors.forEach(c => insertColor.run(productId, c.name, c.hex));
        }

        return productId;
    });

    const productId = insertProduct();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    product.colors = getColorsForProduct(productId);
    res.json(product);
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });

    const {
        name, category_id, image_url, video_url, old_price, new_price,
        discount_percentage, sold_out, position, colors
    } = req.body;

    const updateProduct = db.transaction(() => {
        db.prepare(`
            UPDATE products SET
                name = ?, category_id = ?, image_url = ?, video_url = ?, old_price = ?, new_price = ?,
                discount_percentage = ?, sold_out = ?, position = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(
            name ?? existing.name,
            category_id !== undefined ? category_id : existing.category_id,
            image_url ?? existing.image_url,
            video_url !== undefined ? video_url : existing.video_url,
            old_price !== undefined ? old_price : existing.old_price,
            new_price !== undefined ? new_price : existing.new_price,
            discount_percentage !== undefined ? discount_percentage : existing.discount_percentage,
            sold_out !== undefined ? (sold_out ? 1 : 0) : existing.sold_out,
            position !== undefined ? position : existing.position,
            req.params.id
        );

        if (Array.isArray(colors)) {
            db.prepare('DELETE FROM product_colors WHERE product_id = ?').run(req.params.id);
            const insertColor = db.prepare(
                'INSERT INTO product_colors (product_id, color_name, color_hex) VALUES (?, ?, ?)'
            );
            colors.forEach(c => insertColor.run(req.params.id, c.name, c.hex));
        }
    });

    updateProduct();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    product.colors = getColorsForProduct(req.params.id);
    res.json(product);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const del = db.transaction(() => {
        db.prepare('DELETE FROM product_colors WHERE product_id = ?').run(req.params.id);
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    });
    del();
    res.json({ ok: true });
});

// Configurações do site (upsert parcial, mantendo a linha única)
app.put('/api/admin/site-config', requireAdmin, (req, res) => {
    const existing = db.prepare('SELECT * FROM site_config ORDER BY id LIMIT 1').get();
    const merged = { ...existing, ...req.body };
    delete merged.id;

    const fields = [
        'store_name', 'promo_banner', 'free_shipping_value', 'newsletter_discount',
        'hero_title_1', 'hero_title_2', 'hero_subtitle', 'hero_button', 'hero_image',
        'feature_video_url', 'feature_video_title',
        'color_primary', 'color_secondary', 'color_cta',
        'whatsapp', 'phone', 'email', 'city', 'state', 'working_hours',
        'facebook', 'instagram', 'pinterest'
    ];

    if (existing) {
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        db.prepare(`UPDATE site_config SET ${setClause}, updated_at = datetime('now') WHERE id = ?`)
            .run(...fields.map(f => merged[f] ?? null), existing.id);
    } else {
        const cols = fields.join(', ');
        const placeholders = fields.map(() => '?').join(', ');
        db.prepare(`INSERT INTO site_config (${cols}) VALUES (${placeholders})`)
            .run(...fields.map(f => merged[f] ?? null));
    }

    res.json(db.prepare('SELECT * FROM site_config ORDER BY id LIMIT 1').get());
});

// ---------- Arquivos estáticos ----------
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'painel.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Labella Woman rodando na porta ${PORT}`);
});
