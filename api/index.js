import crypto from 'crypto';

const clean = (s) => (s || '').replace(/^\uFEFF+|\uFEFF+/g, '');

const GITHUB_TOKEN = clean(process.env.GITHUB_TOKEN);
const GITHUB_REPO = clean(process.env.GITHUB_REPO);
const SITE_PASSWORD = clean(process.env.SITE_PASSWORD) || '123456';
const JWT_SECRET = clean(process.env.JWT_SECRET) || SITE_PASSWORD + '_minhnhat_blog_secret_2026';

function b64url(s, d) {
    if (d) return Buffer.from(((s||'').replace(/-/g, '+').replace(/_/g, '/') + '===').slice(0, ((s||'').length+3) & ~3), 'base64').toString();
    return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sign(payload) {
    const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const b = b64url(JSON.stringify(payload));
    const s = crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + b).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return h + '.' + b + '.' + s;
}

function verify(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
        const payload = JSON.parse(b64url(parts[1], true));
        const sig = crypto.createHmac('sha256', JWT_SECRET).update(parts[0] + '.' + parts[1]).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        return sig === parts[2] && Date.now() <= payload.exp;
    } catch { return false; }
}

function parseCookies(req) {
    const c = {};
    (req.headers.cookie || '').split(';').forEach(p => {
        const i = (p||'').indexOf('=');
        if (i > 0) c[clean(p.substring(0,i))] = clean(p.substring(i+1));
    });
    return c;
}

async function readBody(req) {
    let b = '';
    for await (const c of req) b += c;
    b = clean(b);
    try { return JSON.parse(b); } catch { return b; }
}

async function ghFetch(method, path, body) {
    const url = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + clean(path);
    const headers = { 'User-Agent': 'minhnhat-blog' };
    if (GITHUB_TOKEN) headers['Authorization'] = 'Bearer ' + GITHUB_TOKEN;
    if (body) { headers['Content-Type'] = 'application/json'; }
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return res;
}

async function ghSave(path, content, message) {
    content = clean(content);
    let sha = undefined;
    const existing = await ghFetch('GET', path).catch(() => undefined);
    const existingJson = existing ? await existing.json().catch(() => undefined) : undefined;
    if (existingJson && existingJson.sha) sha = existingJson.sha;
    const body = { message: clean(message), content: Buffer.from(content, 'utf-8').toString('base64'), branch: 'main' };
    if (sha) body.sha = sha;
    const res = await ghFetch('PUT', path, body);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(clean(err.message) || 'GitHub error ' + res.status);
    }
}

export default async function handler(req, res) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname;

        if (path === '/api/login' && req.method === 'POST') {
            const body = await readBody(req);
            if (body && body.password === SITE_PASSWORD) {
                const token = sign({ exp: Date.now() + 86400000 });
                res.setHeader('Set-Cookie', 'blog_token=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');
                return res.status(200).json({ ok: true });
            }
            return res.status(401).json({ ok: false, error: 'Sai mat khau' });
        }

        if (path === '/api/session' && req.method === 'GET') {
            return res.status(200).json({ loggedIn: verify(parseCookies(req).blog_token) });
        }

        if (path === '/api/logout' && req.method === 'POST') {
            res.setHeader('Set-Cookie', 'blog_token=; Path=/; HttpOnly; Max-Age=0');
            return res.status(200).json({ ok: true });
        }

        if (path === '/api/save' && req.method === 'POST') {
            if (!verify(parseCookies(req).blog_token)) return res.status(401).json({ ok: false, error: 'Chua dang nhap' });
            const body = await readBody(req);
            const ts = new Date().toLocaleString('vi-VN');
            const saved = [];
            if (body && body.site) { await ghSave('content/site.json', JSON.stringify(body.site), 'Cap nhat site.json - ' + ts); saved.push('site.json'); }
            if (body && body.gallery) { await ghSave('content/gallery.json', JSON.stringify(body.gallery), 'Cap nhat gallery.json - ' + ts); saved.push('gallery.json'); }
            if (body && body.posts) { await ghSave('content/posts.json', JSON.stringify(body.posts), 'Cap nhat posts.json - ' + ts); saved.push('posts.json'); }
            return res.status(200).json({ ok: true, saved });
        }

        if (path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
        return res.status(404).end();
    } catch (err) {
        console.error('API Error:', err);
        return res.status(500).json({ ok: false, error: clean(err.message) || 'Internal error' });
    }
}
