require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

// Carregamento defensivo do sharp: se o binário nativo dele não estiver
// disponível nesta plataforma (ex.: arquitetura diferente no servidor de
// produção), o site inteiro caía por causa disso. Agora, se falhar, o
// servidor sobe normalmente e só a otimização de imagem fica desativada.
let sharp = null;
try {
    sharp = require('sharp');
} catch (err) {
    console.error('sharp indisponível — uploads serão salvos sem otimização de imagem:', err.message);
}

let heicConvert = null;
try {
    heicConvert = require('heic-convert');
} catch (err) {
    console.error('heic-convert indisponível — fotos .HEIC do iPhone não serão convertidas:', err.message);
}

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

// ---------- Otimização de imagens ----------
// Redimensiona (máx. 1600px de largura) e recomprime a imagem enviada.
// Isso é a principal causa de lentidão: fotos de celular chegam com 3-5MB
// e eram salvas sem nenhum tratamento, sendo baixadas inteiras pelos
// visitantes do site. Se a otimização falhar por algum motivo, o arquivo
// original enviado é mantido (nunca quebra o upload).
async function optimizeImage(filePath) {
    if (!sharp) return null; // sharp não carregou nesta plataforma — mantém o arquivo original

    const ext = path.extname(filePath).toLowerCase();
    const isHeic = ext === '.heic' || ext === '.heif';

    try {
        const sizeBefore = fs.statSync(filePath).size;
        let inputBuffer = fs.readFileSync(filePath);
        let finalPath = filePath;

        // Fotos .HEIC/.HEIF (padrão da câmera do iPhone) usam uma compressão
        // com restrição de patente que o sharp não consegue abrir sozinho.
        // Por isso, primeiro convertemos para JPEG com uma biblioteca à parte,
        // e só depois passamos pelo redimensionamento/compressão normal.
        if (isHeic) {
            if (!heicConvert) {
                console.error('Foto .HEIC recebida, mas heic-convert não está disponível — mantendo original.');
                return null;
            }
            inputBuffer = Buffer.from(await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.9 }));
            finalPath = filePath.slice(0, -ext.length) + '.jpg';
        }

        const resizedBuffer = await sharp(inputBuffer).rotate().resize({
            width: 1600,
            withoutEnlargement: true
        }).toBuffer();

        const finalExt = path.extname(finalPath).toLowerCase();
        let pipeline = sharp(resizedBuffer);
        if (finalExt === '.png') {
            pipeline = pipeline.png({ quality: 82, compressionLevel: 8 });
        } else if (finalExt === '.webp') {
            pipeline = pipeline.webp({ quality: 82 });
        } else {
            pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
        }

        const optimized = await pipeline.toBuffer();
        fs.writeFileSync(finalPath, optimized);

        if (finalPath !== filePath) {
            fs.unlinkSync(filePath); // remove o .heic original, já convertido
        }

        return { before: sizeBefore, after: optimized.length, newPath: finalPath };
    } catch (err) {
        console.error('Falha ao otimizar imagem (mantendo original):', err.message);
        return null;
    }
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
    upload.single('image')(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

        const result = await optimizeImage(req.file.path);
        const folder = IMAGE_UPLOAD_FOLDERS[req.query.type] || 'products';
        // Se era uma foto .HEIC do iPhone, o arquivo final é .jpg (nome diferente do original)
        const finalFilename = result && result.newPath ? path.basename(result.newPath) : req.file.filename;
        const url = `/uploads/${folder}/${finalFilename}`;
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

// Cadastro do formulário de newsletter (leads)
app.post('/api/leads', (req, res) => {
    const { email, whatsapp } = req.body;
    if (!email || !email.trim()) return res.status(400).json({ error: 'E-mail é obrigatório' });

    const info = db.prepare(
        'INSERT INTO leads (email, whatsapp, created_at) VALUES (?, ?, datetime(\'now\'))'
    ).run(email.trim(), whatsapp ? whatsapp.trim() : null);

    res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid));
});

// ---------- Rotas administrativas (painel) ----------
app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({ ok: true });
});

// Leads (cadastros do formulário de newsletter do site)
app.get('/api/admin/leads', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
    res.json(rows);
});

app.delete('/api/admin/leads/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
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
        name, category_id, image_url, image_url_2, video_url, old_price, new_price,
        discount_percentage, sold_out, size, is_bestseller, colors
    } = req.body;

    if (!name || !image_url) {
        return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });
    }

    const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM products').get();
    const position = (maxPos.maxPos || 0) + 1;

    const insertProduct = db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO products
                (name, category_id, image_url, image_url_2, video_url, old_price, new_price, discount_percentage, sold_out, size, is_bestseller, position, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            name, category_id || null, image_url, image_url_2 || null, video_url || null,
            old_price || 0, new_price || 0, discount_percentage || 0,
            sold_out ? 1 : 0, size || null, is_bestseller ? 1 : 0, position
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
        name, category_id, image_url, image_url_2, video_url, old_price, new_price,
        discount_percentage, sold_out, size, is_bestseller, position, colors
    } = req.body;

    const updateProduct = db.transaction(() => {
        db.prepare(`
            UPDATE products SET
                name = ?, category_id = ?, image_url = ?, image_url_2 = ?, video_url = ?, old_price = ?, new_price = ?,
                discount_percentage = ?, sold_out = ?, size = ?, is_bestseller = ?, position = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(
            name ?? existing.name,
            category_id !== undefined ? category_id : existing.category_id,
            image_url ?? existing.image_url,
            image_url_2 !== undefined ? image_url_2 : existing.image_url_2,
            video_url !== undefined ? video_url : existing.video_url,
            old_price !== undefined ? old_price : existing.old_price,
            new_price !== undefined ? new_price : existing.new_price,
            discount_percentage !== undefined ? discount_percentage : existing.discount_percentage,
            sold_out !== undefined ? (sold_out ? 1 : 0) : existing.sold_out,
            size !== undefined ? size : existing.size,
            is_bestseller !== undefined ? (is_bestseller ? 1 : 0) : existing.is_bestseller,
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

// Duplicar produto (copia todos os campos, imagens e cores; entra como "Esgotado: não" no fim da lista)
app.post('/api/admin/products/:id/duplicate', requireAdmin, (req, res) => {
    const original = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!original) return res.status(404).json({ error: 'Produto não encontrado' });

    const duplicate = db.transaction(() => {
        const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM products').get();
        const position = (maxPos.maxPos || 0) + 1;

        const info = db.prepare(`
            INSERT INTO products
                (name, category_id, image_url, image_url_2, video_url, old_price, new_price, discount_percentage, sold_out, size, is_bestseller, position, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            `${original.name} (cópia)`, original.category_id, original.image_url, original.image_url_2,
            original.video_url, original.old_price, original.new_price, original.discount_percentage,
            original.sold_out, original.size, original.is_bestseller, position
        );

        const newProductId = info.lastInsertRowid;
        const colors = getColorsForProduct(original.id);
        if (colors.length > 0) {
            const insertColor = db.prepare(
                'INSERT INTO product_colors (product_id, color_name, color_hex) VALUES (?, ?, ?)'
            );
            colors.forEach(c => insertColor.run(newProductId, c.color_name, c.color_hex));
        }

        return newProductId;
    });

    const newProductId = duplicate();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(newProductId);
    product.colors = getColorsForProduct(newProductId);
    res.json(product);
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
        'feature1_title', 'feature1_desc', 'feature2_title', 'feature2_desc',
        'feature3_title', 'feature3_desc', 'feature4_title', 'feature4_desc',
        'color_primary', 'color_secondary', 'color_cta', 'theme_mode',
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
// Reprocessa todas as imagens já enviadas (produtos, hero, banners) com a
// mesma otimização usada em novos uploads. Útil porque fotos cadastradas
// antes dessa otimização existir continuam pesadas e deixam o site lento.
app.post('/api/admin/optimize-existing-images', requireAdmin, async (req, res) => {
    if (!sharp) return res.status(400).json({ error: 'Otimização de imagem indisponível neste servidor' });

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    const foldersToScan = ['products', 'hero', 'banners'];
    let processed = 0;
    let skipped = 0;
    let renamed = 0;
    let sizeBefore = 0;
    let sizeAfter = 0;

    for (const folder of foldersToScan) {
        const dir = path.join(UPLOADS_DIR, folder);
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir);
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (!imageExtensions.includes(ext)) continue;

            const filePath = path.join(dir, file);
            const result = await optimizeImage(filePath);
            if (result) {
                processed++;
                sizeBefore += result.before;
                sizeAfter += result.after;

                // Se a foto era .HEIC/.HEIF, o arquivo final ficou com outro
                // nome (.jpg) — sem isso, o produto ficaria apontando pra um
                // arquivo que não existe mais.
                if (result.newPath && result.newPath !== filePath) {
                    const oldUrl = `/uploads/${folder}/${file}`;
                    const newUrl = `/uploads/${folder}/${path.basename(result.newPath)}`;
                    db.prepare('UPDATE products SET image_url = ? WHERE image_url = ?').run(newUrl, oldUrl);
                    db.prepare('UPDATE products SET image_url_2 = ? WHERE image_url_2 = ?').run(newUrl, oldUrl);
                    db.prepare('UPDATE site_config SET hero_image = ? WHERE hero_image = ?').run(newUrl, oldUrl);
                    db.prepare('UPDATE banners SET image_url = ? WHERE image_url = ?').run(newUrl, oldUrl);
                    renamed++;
                }
            } else {
                skipped++;
            }
        }
    }

    res.json({
        processed,
        skipped,
        renamed,
        sizeBeforeMB: (sizeBefore / (1024 * 1024)).toFixed(1),
        sizeAfterMB: (sizeAfter / (1024 * 1024)).toFixed(1)
    });
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'painel.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Selá rodando na porta ${PORT}`);
});
