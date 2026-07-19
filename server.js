const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3000;
const PASSWORD = '123456';
const ROOT = __dirname;

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

    if (pathname === '/api/login' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body.password === PASSWORD) {
            return send(res, 200, { ok: true });
        }
        return send(res, 401, { ok: false, error: 'Sai mat khau' });
    }

    if (pathname === '/api/save' && req.method === 'POST') {
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
    console.log(`Nhan Ctrl+C de dung`);
});
