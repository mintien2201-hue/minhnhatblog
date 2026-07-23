// ============================================================
// Blog Server (Local Development)
// ESM module (phù hợp "type": "module" trong package.json)
// Bảo mật: mật khẩu từ env, chống path traversal, session an toàn
// ============================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.SITE_PASSWORD || '123456';
const SESSION_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// In-memory session store (chỉ dùng local)
const sessions = new Map();

function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        created: Date.now(),
        expires: Date.now() + 24 * 60 * 60 * 1000
    });
    return token;
}

function isValidSession(token) {
    if (!token || !sessions.has(token)) return false;
    const s = sessions.get(token);
    if (Date.now() > s.expires) {
        sessions.delete(token);
        return false;
    }
    return true;
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8'
};

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 5 * 1024 * 1024) {
                reject(new Error('Body too large'));
                req.destroy();
            }
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve(body); }
        });
        req.on('error', reject);
    });
}

function send(res, status, data) {
    res.writeHead(status, {
        'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

function parseCookies(req) {
    const c = {};
    (req.headers.cookie || '').split(';').forEach(p => {
        const i = p.indexOf('=');
        if (i > 0) c[p.substring(0, i).trim()] = p.substring(i + 1).trim();
    });
    return c;
}

function gitCommit(message) {
    try {
        execSync('git add content/', { cwd: ROOT, stdio: 'ignore' });
        execSync(`git commit -m "${message}" --allow-empty`, { cwd: ROOT, stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// Chống path traversal: resolve và kiểm tra nằm trong ROOT
function safeJoin(base, target) {
    const resolved = path.resolve(base, '.' + target);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
        return null;
    }
    return resolved;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // ====== API: Login ======
    if (pathname === '/api/login' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body.password === PASSWORD) {
            const token = createSession();
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Set-Cookie': `blog_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
            });
            return res.end(JSON.stringify({ ok: true }));
        }
        return send(res, 401, { ok: false, error: 'Sai mật khẩu' });
    }

    // ====== API: Logout ======
    if (pathname === '/api/logout' && req.method === 'POST') {
        const cookies = parseCookies(req);
        if (cookies.blog_token) sessions.delete(cookies.blog_token);
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Set-Cookie': 'blog_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
        });
        return res.end(JSON.stringify({ ok: true }));
    }

    // ====== API: Session check ======
    if (pathname === '/api/session' && req.method === 'GET') {
        const cookies = parseCookies(req);
        const valid = isValidSession(cookies.blog_token);
        return send(res, 200, { loggedIn: valid });
    }

    // ====== API: Save content ======
    if (pathname === '/api/save' && req.method === 'POST') {
        const cookies = parseCookies(req);
        if (!isValidSession(cookies.blog_token)) {
            return send(res, 401, { ok: false, error: 'Chưa đăng nhập' });
        }
        const body = await parseBody(req);
        try {
            if (body.site) {
                fs.writeFileSync(
                    path.join(ROOT, 'content', 'site.json'),
                    JSON.stringify(body.site, null, 2)
                );
            }
            if (body.gallery) {
                fs.writeFileSync(
                    path.join(ROOT, 'content', 'gallery.json'),
                    JSON.stringify(body.gallery, null, 2)
                );
            }
            if (body.posts) {
                fs.writeFileSync(
                    path.join(ROOT, 'content', 'posts.json'),
                    JSON.stringify(body.posts, null, 2)
                );
            }
            const committed = gitCommit('Cập nhật blog từ trang quản trị');
            return send(res, 200, { ok: true, committed });
        } catch (err) {
            return send(res, 500, { ok: false, error: err.message });
        }
    }

    // ====== Static files (an toàn) ======
    let filePath = safeJoin(ROOT, pathname === '/' ? 'index.html' : pathname);
    if (!filePath || !fs.existsSync(filePath)) {
        res.writeHead(404);
        return res.end('Not found');
    }
    if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': mime });
        res.end(content);
    } catch {
        res.writeHead(500);
        res.end('Internal error');
    }
});

server.listen(PORT, () => {
    console.log(`Blog server đang chạy tại http://localhost:${PORT}`);
    console.log(`Đăng nhập admin: http://localhost:${PORT}/login.html`);
    console.log(`Nhấn Ctrl+C để dừng`);
});
