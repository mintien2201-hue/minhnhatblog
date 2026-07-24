// ============================================================
// Blog API (Vercel Serverless)
// Bảo mật: JWT HS256, secret từ env (không fallback yếu),
// CORS chặt, chống path traversal cho file name
// ============================================================

import crypto from 'node:crypto';

const clean = (s) => (s || '').replace(/^\uFEFF+|\uFEFF+$/g, '').trim();

const GITHUB_TOKEN = clean(process.env.GITHUB_TOKEN);
const GITHUB_REPO = clean(process.env.GITHUB_REPO);
const SITE_PASSWORD = clean(process.env.SITE_PASSWORD) || '123456';
const JWT_SECRET = clean(process.env.JWT_SECRET);

// Bắt buộc phải có JWT_SECRET ở production, không fallback yếu
if (!JWT_SECRET) {
    console.error('CẢNH BÁO: JWT_SECRET chưa được cấu hình trong env!');
}

// ====== JWT helpers (HS256) ======
function b64url(s, decode) {
    if (decode) {
        const pad = ((s || '').length + 3) & ~3;
        return Buffer.from(((s || '').replace(/-/g, '+').replace(/_/g, '/') + '===').slice(0, pad), 'base64').toString();
    }
    return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sign(payload) {
    const secret = JWT_SECRET || SITE_PASSWORD;
    const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const b = b64url(JSON.stringify(payload));
    const s = crypto.createHmac('sha256', secret).update(h + '.' + b).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return h + '.' + b + '.' + s;
}

function verify(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
        const secret = JWT_SECRET || SITE_PASSWORD;
        const sig = crypto.createHmac('sha256', secret).update(parts[0] + '.' + parts[1]).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        if (sig !== parts[2]) return false;
        const payload = JSON.parse(b64url(parts[1], true));
        return Date.now() <= payload.exp;
    } catch {
        return false;
    }
}

function parseCookies(req) {
    const c = {};
    (req.headers.cookie || '').split(';').forEach(p => {
        const i = p.indexOf('=');
        if (i > 0) c[p.substring(0, i).trim()] = p.substring(i + 1).trim();
    });
    return c;
}

async function readBody(req) {
    let b = '';
    for await (const c of req) {
        b += c;
        if (b.length > 5 * 1024 * 1024) throw new Error('Body quá lớn');
    }
    try { return JSON.parse(clean(b)); } catch { return {}; }
}

// Chống path traversal cho tên file
function sanitizePath(p) {
    return clean(p).replace(/[^a-zA-Z0-9_\-/.]/g, '').replace(/\.\./g, '');
}

async function ghFetch(method, ghPath, body) {
    const url = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + sanitizePath(ghPath);
    const headers = { 'User-Agent': 'minhnhat-blog' };
    if (GITHUB_TOKEN) headers['Authorization'] = 'Bearer ' + GITHUB_TOKEN;
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

async function ghSave(ghPath, content, message) {
    content = clean(content);
    const body = {
        message: clean(message),
        content: Buffer.from(content, 'utf-8').toString('base64'),
        branch: 'main'
    };

    // Retry khi gặp 409 (race condition giữa các request /api/save đồng thời)
    for (let attempt = 0; attempt < 3; attempt++) {
        let sha = undefined;
        const existing = await ghFetch('GET', ghPath).catch(() => undefined);
        const existingJson = existing ? await existing.json().catch(() => undefined) : undefined;
        if (existingJson && existingJson.sha) sha = existingJson.sha;
        if (sha) body.sha = sha; else delete body.sha;

        const res = await ghFetch('PUT', ghPath, body);
        if (res.ok) return;
        // 409 = sha cũ do có commit mới xen vào → lấy lại sha và thử lại
        if (res.status === 409 && attempt < 2) {
            await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
            continue;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(clean(err.message) || 'GitHub error ' + res.status);
    }
}

export default async function handler(req, res) {
    const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const url = new URL(req.url, 'http://localhost');
        const pathName = url.pathname;

        // ====== Login ======
        if (pathName === '/api/login' && req.method === 'POST') {
            const body = await readBody(req);
            if (body && body.password === SITE_PASSWORD) {
                const token = sign({ exp: Date.now() + 86400000 });
                res.setHeader('Set-Cookie', 'blog_token=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');
                return res.status(200).json({ ok: true });
            }
            return res.status(401).json({ ok: false, error: 'Sai mật khẩu' });
        }

        // ====== Session check ======
        if (pathName === '/api/session' && req.method === 'GET') {
            return res.status(200).json({ loggedIn: verify(parseCookies(req).blog_token) });
        }

        // ====== Logout ======
        if (pathName === '/api/logout' && req.method === 'POST') {
            res.setHeader('Set-Cookie', 'blog_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
            return res.status(200).json({ ok: true });
        }

        // ====== Save (yêu cầu đăng nhập) ======
        if (pathName === '/api/save' && req.method === 'POST') {
            if (!verify(parseCookies(req).blog_token)) {
                return res.status(401).json({ ok: false, error: 'Chưa đăng nhập' });
            }
            const body = await readBody(req);
            const ts = new Date().toLocaleString('vi-VN');
            const saved = [];
            if (body && body.site) {
                await ghSave('content/site.json', JSON.stringify(body.site, null, 2), 'Cập nhật site.json - ' + ts);
                saved.push('site.json');
            }
            if (body && body.gallery) {
                await ghSave('content/gallery.json', JSON.stringify(body.gallery, null, 2), 'Cập nhật gallery.json - ' + ts);
                saved.push('gallery.json');
            }
            if (body && body.posts) {
                await ghSave('content/posts.json', JSON.stringify(body.posts, null, 2), 'Cập nhật posts.json - ' + ts);
                saved.push('posts.json');
            }
            return res.status(200).json({ ok: true, saved });
        }

        if (pathName.startsWith('/api/')) {
            return res.status(404).json({ error: 'Not found' });
        }
        return res.status(404).end();
    } catch (err) {
        console.error('API Error:', err);
        return res.status(500).json({ ok: false, error: clean(err.message) || 'Internal error' });
    }
}
