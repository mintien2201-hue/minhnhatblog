import crypto from 'crypto';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const SITE_PASSWORD = process.env.SITE_PASSWORD || '123456';
const JWT_SECRET = process.env.JWT_SECRET || SITE_PASSWORD + '_minhnhat_blog_secret_2026';

function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString();
}

function createSession() {
    const payload = { exp: Date.now() + 24 * 60 * 60 * 1000 };
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return header + '.' + body + '.' + signature;
}

function isValidSession(token) {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (signature !== expectedSig) return false;
    try {
        const payload = JSON.parse(base64UrlDecode(body));
        if (Date.now() > payload.exp) return false;
        return true;
    } catch { return false; }
}

function parseCookies(req) {
    const cookies = {};
    const cookieHeader = req.headers.cookie || '';
    cookieHeader.split(';').forEach(c => {
        const trimmed = c.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            const k = trimmed.substring(0, eqIdx).replace(/^\uFEFF/, '').trim();
            const v = trimmed.substring(eqIdx + 1).replace(/^\uFEFF/, '').trim();
            if (k) cookies[k] = v;
        }
    });
    return cookies;
}

async function githubGetFile(filePath) {
    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + filePath, {
        headers: { Authorization: 'token ' + GITHUB_TOKEN, 'User-Agent': 'minhnhat-blog' }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('GitHub API ' + res.status);
    return res.json();
}

async function githubUpdateFile(filePath, content, message) {
    let sha = null;
    const existing = await githubGetFile(filePath);
    if (existing) sha = existing.sha;

    content = content.replace(/^\uFEFF/, '').replace(/\uFEFF/g, '');

    const body = {
        message: message,
        content: Buffer.from(content).toString('base64'),
        branch: 'main'
    };
    if (sha) body.sha = sha;

    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + filePath, {
        method: 'PUT',
        headers: { Authorization: 'token ' + GITHUB_TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'minhnhat-blog' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'GitHub API loi ' + res.status);
    }
    return res.json();
}

async function parseBody(req) {
    let body = '';
    for await (const chunk of req) body += chunk;
    body = body.replace(/^\uFEFF/, '');
    try { return JSON.parse(body); } catch { return body; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    try {
        if (pathname === '/api/login' && req.method === 'POST') {
            const body = await parseBody(req);
            if (body.password === SITE_PASSWORD) {
                const token = createSession();
                res.setHeader('Set-Cookie', 'blog_token=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');
                return res.status(200).json({ ok: true });
            }
            return res.status(401).json({ ok: false, error: 'Sai mat khau' });
        }

        if (pathname === '/api/session' && req.method === 'GET') {
            const cookies = parseCookies(req);
            return res.status(200).json({ loggedIn: isValidSession(cookies.blog_token) });
        }

        if (pathname === '/api/logout' && req.method === 'POST') {
            res.setHeader('Set-Cookie', 'blog_token=; Path=/; HttpOnly; Max-Age=0');
            return res.status(200).json({ ok: true });
        }

        if (pathname === '/api/save' && req.method === 'POST') {
            const cookies = parseCookies(req);
            if (!isValidSession(cookies.blog_token)) {
                return res.status(401).json({ ok: false, error: 'Chua dang nhap' });
            }

            const body = await parseBody(req);
            const timestamp = new Date().toLocaleString('vi-VN');
            const results = [];

            if (body.site) {
                await githubUpdateFile('content/site.json', JSON.stringify(body.site, null, 2), 'Cap nhat site.json - ' + timestamp);
                results.push('site.json');
            }
            if (body.gallery) {
                await githubUpdateFile('content/gallery.json', JSON.stringify(body.gallery, null, 2), 'Cap nhat gallery.json - ' + timestamp);
                results.push('gallery.json');
            }
            if (body.posts) {
                await githubUpdateFile('content/posts.json', JSON.stringify(body.posts, null, 2), 'Cap nhat posts.json - ' + timestamp);
                results.push('posts.json');
            }

            return res.status(200).json({ ok: true, saved: results });
        }

        if (pathname.startsWith('/api/')) {
            return res.status(404).json({ error: 'Not found' });
        }

        return res.status(404).end();

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
