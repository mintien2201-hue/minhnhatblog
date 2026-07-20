const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PORT = 3000;
const PASSWORD = '123456';
const ROOT = __dirname;

const sessions = new Map();

function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { created: Date.now(), expires: Date.now() + 24 * 60 * 60 * 1000 });
    return token;
}

function isValidSession(token) {
    if (!token || !sessions.has(token)) return false;
    const s = sessions.get(token);
    if (Date.now() > s.expires) { sessions.delete(token); return false; }
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
    '.txt': 'text/plain; charset=utf-8',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
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

function gitCommit(message) {
    try {
        execSync('git add content/', { cwd: ROOT, stdio: 'ignore' });
        execSync(`git commit -m "${message}" --allow-empty`, { cwd: ROOT, stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
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

    if (pathname === '/api/save' && req.method === 'POST') {
        const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
            const [k, v] = c.trim().split('=');
            acc[k] = v; return acc;
        }, {});
        if (!isValidSession(cookies.blog_token)) {
            return send(res, 401, { ok: false, error: 'Chua dang nhap' });
        }
        const body = await parseBody(req);
        try {
            if (body.site) {
                fs.writeFileSync(path.join(ROOT, 'content', 'site.json'), JSON.stringify(body.site, null, 2));
            }
            if (body.gallery) {
                fs.writeFileSync(path.join(ROOT, 'content', 'gallery.json'), JSON.stringify(body.gallery, null, 2));
            }
            if (body.posts) {
                fs.writeFileSync(path.join(ROOT, 'content', 'posts.json'), JSON.stringify(body.posts, null, 2));
            }
            const committed = gitCommit('Cap nhat blog tu trang quan tri');
            return send(res, 200, { ok: true, committed });
        } catch (err) {
            return send(res, 500, { ok: false, error: err.message });
        }
    }

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
        return send(res, 401, { ok: false, error: 'Sai mat khau' });
    }

    if (pathname === '/api/logout' && req.method === 'POST') {
        const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
            const [k, v] = c.trim().split('=');
            acc[k] = v; return acc;
        }, {});
        if (cookies.blog_token) sessions.delete(cookies.blog_token);
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Set-Cookie': 'blog_token=; Path=/; HttpOnly; Max-Age=0'
        });
        return res.end(JSON.stringify({ ok: true }));
    }

    if (pathname === '/api/session' && req.method === 'GET') {
        const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
            const [k, v] = c.trim().split('=');
            acc[k] = v; return acc;
        }, {});
        const valid = isValidSession(cookies.blog_token);
        return send(res, 200, { loggedIn: valid });
    }

    let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        return res.end('Not found');
    }
    if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
});

server.listen(PORT, () => {
    console.log(`Blog server dang chay tai http://localhost:${PORT}`);
    console.log(`Dang nhap admin: http://localhost:${PORT}/login.html`);
    console.log(`Nhan Ctrl+C de dung`);
});
