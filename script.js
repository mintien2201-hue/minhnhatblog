// ============================================================
// Blog - Client Script
// Tách biệt rõ: Public (chỉ xem) vs Admin (có quyền chỉnh sửa)
// - Visitor: không thấy nút bút chì, không load GitHub token
// - Admin (đã login): thấy nút bút chì, bật edit mode, xuất bản
// Bảo mật: escape HTML trước khi render, xóa ảnh GitHub khi xóa
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    let isAdmin = false;        // Chỉ true khi đã đăng nhập
    let isEditing = false;

    // Cache busting cố định theo version (không phải Date.now để giữ cache)
    const CACHE_BUST = '?v=20260723';

    // DOM
    const adminControls = document.getElementById('adminControls');
    const editBtn = document.getElementById('editToggle');
    const publishBtn = document.getElementById('publishBtn');
    const publishStatus = document.getElementById('publishStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    const fileInput = document.getElementById('fileInput');
    const galleryGrid = document.getElementById('gallery-grid');
    const blogGrid = document.getElementById('blog-grid');
    const editables = document.querySelectorAll('[contenteditable]');
    let revealObserver;

    // =====================
    // UTILITIES
    // =====================

    // Escape HTML để chống XSS khi render nội dung user cung cấp
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function stripBom(str) {
        if (!str) return '';
        return str.replace(/^\uFEFF/, '').replace(/\uFEFF/g, '');
    }

    // Chuyển text thuần thành text node an toàn (không interpret HTML)
    // contenteditable trả về HTML, ta dùng textContent để lấy text thuần
    function getEditableText(el) {
        const clone = el.cloneNode(true);
        // Thay <br> và <div> bằng xuống dòng
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        clone.querySelectorAll('div').forEach(div => {
            div.insertAdjacentText('beforebegin', '\n');
        });
        return stripBom(clone.textContent || '');
    }

    function sanitizeForDisplay(html) {
        // Chỉ cho phép các thẻ an toàn, strip script/event handler
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        // Xóa script, style, iframe, object, embed
        tmp.querySelectorAll('script, style, iframe, object, embed, link').forEach(el => el.remove());
        // Xóa mọi event handler on*
        tmp.querySelectorAll('*').forEach(el => {
            [...el.attributes].forEach(attr => {
                if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
            });
        });
        return tmp.innerHTML;
    }

    // =====================
    // CHECK ADMIN SESSION
    // =====================
    fetch('/api/session').then(r => r.json()).then(data => {
        if (data.loggedIn) {
            isAdmin = true;
            adminControls.style.display = '';
        } else {
            isAdmin = false;
            adminControls.style.display = 'none';
        }
    }).catch(() => {
        isAdmin = false;
        adminControls.style.display = 'none';
    });

    // =====================
    // LOGOUT
    // =====================
    logoutBtn.addEventListener('click', function () {
        fetch('/api/logout', { method: 'POST' }).finally(() => {
            isAdmin = false;
            enableEditing(false);
            adminControls.style.display = 'none';
            window.location.href = 'index.html';
        });
    });

    // =====================
    // EDIT MODE (chỉ admin)
    // =====================
    function enableEditing(on) {
        if (!isAdmin && on) return; // Không phải admin thì không cho bật
        isEditing = on;
        editables.forEach(el => el.setAttribute('contenteditable', on ? 'true' : 'false'));
        editBtn.textContent = on ? '✓' : '✏️';
        editBtn.classList.toggle('active', on);
        document.body.classList.toggle('edit-mode', on);
        if (!on) saveAllToLocal();
        renderGallery();
        renderBlog();
    }

    editBtn.addEventListener('click', function () {
        if (!isAdmin) return;
        enableEditing(!isEditing);
    });

    // =====================
    // LOCAL STORAGE (cache tạm, không phải DB thật)
    // =====================
    let persistTimer = null;

    function persistToServer() {
        if (!isAdmin) return; // Chỉ admin mới persist
        clearTimeout(persistTimer);
        persistTimer = setTimeout(async () => {
            try {
                const siteData = {};
                editables.forEach(el => {
                    const f = el.dataset.field;
                    if (f) siteData[f] = getEditableText(el);
                });
                await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ site: siteData, gallery: getGalleryData(), posts: getBlogData() })
                });
            } catch {}
        }, 3000);
    }

    function saveAllToLocal() {
        const data = {};
        editables.forEach(el => {
            const field = el.dataset.field;
            if (field) data[field] = getEditableText(el);
        });
        data._gallery = getGalleryData();
        data._posts = getBlogData();
        try { localStorage.setItem('blog_data', JSON.stringify(data)); } catch {}
        persistToServer();
    }

    function loadFromLocal() {
        try {
            const saved = JSON.parse(localStorage.getItem('blog_data'));
            if (!saved) return false;
            editables.forEach(el => {
                const field = el.dataset.field;
                if (field && saved[field] !== undefined) el.innerHTML = sanitizeForDisplay(saved[field]);
            });
            if (saved._gallery) { saveGalleryData(saved._gallery); renderGallery(); }
            if (saved._posts) { saveBlogData(saved._posts); renderBlog(); }
            return true;
        } catch { return false; }
    }

    document.addEventListener('input', function (e) {
        if (e.target.getAttribute('contenteditable') === 'true') {
            saveAllToLocal();
        }
    });

    window.addEventListener('beforeunload', function () {
        clearTimeout(persistTimer);
        if (isEditing && isAdmin) {
            const siteData = {};
            editables.forEach(el => {
                const f = el.dataset.field;
                if (f) siteData[f] = getEditableText(el);
            });
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/save', false);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.withCredentials = true;
                xhr.send(JSON.stringify({ site: siteData, gallery: getGalleryData(), posts: getBlogData() }));
            } catch {}
        }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden && isEditing) saveAllToLocal();
    });

    setInterval(function () {
        if (isEditing && isAdmin) saveAllToLocal();
    }, 15000);

    // =====================
    // GALLERY
    // =====================
    const GALLERY_KEY = 'blog_gallery';

    function getGalleryData() {
        try { return JSON.parse(localStorage.getItem(GALLERY_KEY)) || []; } catch { return []; }
    }

    function saveGalleryData(data) {
        localStorage.setItem(GALLERY_KEY, JSON.stringify(data));
    }

    // Render gallery - dùng textContent cho note để chống XSS
    function renderGallery() {
        const data = getGalleryData();
        galleryGrid.innerHTML = '';
        data.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.setAttribute('data-index', i);
            div.setAttribute('data-reveal', '');
            div.setAttribute('data-reveal-delay', String((i % 4 + 1) * 100));
            if (revealObserver) revealObserver.observe(div);

            const img = document.createElement('img');
            img.src = escapeHtml(item.src || '');
            img.alt = 'Tác phẩm';
            img.loading = 'lazy';
            div.appendChild(img);

            const overlay = document.createElement('div');
            overlay.className = 'gallery-overlay';
            const note = document.createElement('span');
            note.className = 'gallery-note';
            note.setAttribute('contenteditable', isEditing ? 'true' : 'false');
            note.textContent = item.note || ''; // textContent = chống XSS
            overlay.appendChild(note);
            div.appendChild(overlay);

            if (isEditing) {
                const del = document.createElement('button');
                del.className = 'item-delete';
                del.textContent = '✕';
                del.title = 'Xóa';
                div.appendChild(del);
            }
            galleryGrid.appendChild(div);
        });

        if (isEditing) {
            const add = document.createElement('div');
            add.className = 'add-btn add-btn-gallery';
            add.textContent = '+ Thêm tác phẩm';
            add.addEventListener('click', () => fileInput.click());
            galleryGrid.appendChild(add);
        }
        attachGalleryEvents();
    }

    function attachGalleryEvents() {
        document.querySelectorAll('#gallery-grid .gallery-item').forEach(item => {
            const del = item.querySelector('.item-delete');
            if (del) {
                del.addEventListener('click', async function (e) {
                    e.stopPropagation();
                    const data = getGalleryData();
                    const idx = Array.from(galleryGrid.children).indexOf(item);
                    if (idx > -1) {
                        const removed = data[idx];
                        if (removed && removed.src) {
                            // Nếu ảnh trên GitHub → thêm vào danh sách xóa
                            if (removed.src.startsWith('https://raw.githubusercontent.com/')) {
                                const repoPath = extractGitHubPath(removed.src);
                                if (repoPath) {
                                    addDeletedFile(repoPath);
                                    // Xóa ngay trên GitHub
                                    const auth = await ensureGithubToken();
                                    if (auth) {
                                        try {
                                            await ghDeleteFile(auth.token, auth.repo, repoPath);
                                        } catch (err) {
                                            console.warn('Không xóa được ảnh trên GitHub:', err.message);
                                        }
                                    }
                                }
                            }
                        }
                        data.splice(idx, 1);
                        saveGalleryData(data);
                        saveAllToLocal();
                        renderGallery();
                    }
                });
            }
            const note = item.querySelector('.gallery-note');
            if (note) {
                note.addEventListener('blur', function () {
                    const data = getGalleryData();
                    const idx = Array.from(galleryGrid.children).indexOf(item);
                    if (data[idx]) {
                        data[idx].note = stripBom(this.textContent); // textContent an toàn
                        saveGalleryData(data);
                        saveAllToLocal();
                    }
                });
            }
            item.addEventListener('click', function (e) {
                if (e.target.closest('.item-delete') || e.target.getAttribute('contenteditable') === 'true') return;
                const img = this.querySelector('img');
                const noteEl = this.querySelector('.gallery-note');
                if (!img) return;
                openLightbox(img.src, noteEl ? noteEl.textContent : '');
            });
        });
    }

    function openLightbox(src, note) {
        const ov = document.createElement('div');
        ov.className = 'lightbox';
        const bg = document.createElement('div');
        bg.className = 'lightbox-bg';
        const content = document.createElement('div');
        content.className = 'lightbox-content';
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.className = 'lightbox-img';
        content.appendChild(img);
        if (note) {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'lightbox-note';
            noteDiv.textContent = note; // textContent chống XSS
            content.appendChild(noteDiv);
        }
        const closeBtn = document.createElement('button');
        closeBtn.className = 'lightbox-close';
        closeBtn.textContent = '✕';
        ov.appendChild(bg);
        ov.appendChild(content);
        ov.appendChild(closeBtn);
        document.body.appendChild(ov);
        const savedScrollY = window.scrollY;
        document.body.classList.add('lightbox-open');
        const preventTouch = function (ev) { ev.preventDefault(); };
        ov.addEventListener('touchmove', preventTouch, { passive: false });
        setTimeout(() => ov.classList.add('active'), 10);
        const close = () => {
            ov.classList.remove('active');
            ov.removeEventListener('touchmove', preventTouch);
            setTimeout(() => {
                ov.remove();
                document.body.classList.remove('lightbox-open');
                window.scrollTo(0, savedScrollY);
            }, 300);
        };
        closeBtn.addEventListener('click', close);
        bg.addEventListener('click', close);
        document.addEventListener('keydown', function h(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', h); }
        });
    }

    // =====================
    // IMAGE UPLOAD + COMPRESS
    // =====================
    function compressImage(file, maxWidth, quality) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    canvas.toBlob(function (blob) {
                        resolve(blob || file);
                    }, 'image/jpeg', quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    fileInput.addEventListener('change', async function () {
        if (!isAdmin) return;
        const files = Array.from(this.files);
        if (!files.length) return;
        const auth = await ensureGithubToken();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                publishStatus.textContent = 'Đang xử lý ảnh ' + (i + 1) + '/' + files.length + '...';
                const compressed = await compressImage(file, 1200, 0.82);
                const reader = new FileReader();
                const dataUrl = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(compressed); });
                const base64Content = dataUrl.split(',')[1];
                let src = dataUrl;
                if (auth) {
                    try {
                        publishStatus.textContent = 'Đang tải ảnh ' + (i + 1) + '/' + files.length + ' lên GitHub...';
                        const filename = generateImageFilename(file.name);
                        await ghUploadImage(auth.token, auth.repo, GH_UPLOAD_DIR + '/' + filename, base64Content);
                        src = 'https://raw.githubusercontent.com/' + auth.repo + '/main/' + GH_UPLOAD_DIR + '/' + filename;
                    } catch (err) {
                        console.warn('Lỗi tải ảnh lên GitHub:', err.message);
                    }
                }
                const data = getGalleryData();
                data.push({ src: src, note: 'Ghi chú...' });
                saveGalleryData(data);
                saveAllToLocal();
                renderGallery();
            } catch (err) {
                console.warn('Lỗi xử lý ảnh:', err.message);
            }
        }
        publishStatus.textContent = '';
        setTimeout(() => { publishStatus.textContent = ''; }, 2000);
        this.value = '';
    });

    // =====================
    // BLOG POSTS
    // =====================
    const BLOG_KEY = 'blog_posts';

    function getBlogData() {
        try { return JSON.parse(localStorage.getItem(BLOG_KEY)) || []; } catch { return []; }
    }

    function saveBlogData(data) {
        localStorage.setItem(BLOG_KEY, JSON.stringify(data));
    }

    // Render blog - dùng textContent cho nội dung để chống XSS
    function renderBlog() {
        const data = getBlogData();
        blogGrid.innerHTML = '';
        data.forEach((post, i) => {
            const article = document.createElement('article');
            article.className = 'blog-card';
            article.setAttribute('data-reveal', '');
            article.setAttribute('data-reveal-delay', String((i % 4 + 1) * 100));
            if (revealObserver) revealObserver.observe(article);

            const date = document.createElement('div');
            date.className = 'card-date';
            date.setAttribute('contenteditable', isEditing ? 'true' : 'false');
            date.textContent = post.date || '';
            article.appendChild(date);

            const h3 = document.createElement('h3');
            h3.setAttribute('contenteditable', isEditing ? 'true' : 'false');
            h3.textContent = post.title || '';
            article.appendChild(h3);

            const p = document.createElement('p');
            p.setAttribute('contenteditable', isEditing ? 'true' : 'false');
            p.textContent = post.content || '';
            article.appendChild(p);

            const readMore = document.createElement('a');
            readMore.href = '#';
            readMore.className = 'read-more';
            readMore.textContent = 'Đọc tiếp';
            article.appendChild(readMore);

            if (isEditing) {
                const del = document.createElement('button');
                del.className = 'item-delete';
                del.textContent = '✕';
                del.title = 'Xóa';
                article.appendChild(del);
            }
            blogGrid.appendChild(article);
        });

        if (isEditing) {
            const add = document.createElement('div');
            add.className = 'add-btn add-btn-blog';
            add.textContent = '+ Thêm bài viết';
            add.addEventListener('click', function () {
                const data = getBlogData();
                data.push({ date: 'Ngày tháng', title: 'Tiêu đề', content: 'Nội dung...' });
                saveBlogData(data);
                saveAllToLocal();
                renderBlog();
            });
            blogGrid.appendChild(add);
        }
        attachBlogEvents();
    }

    function attachBlogEvents() {
        document.querySelectorAll('#blog-grid .blog-card').forEach(card => {
            const del = card.querySelector('.item-delete');
            if (del) {
                del.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const data = getBlogData();
                    const idx = Array.from(blogGrid.children).indexOf(card);
                    if (idx > -1) {
                        data.splice(idx, 1);
                        saveBlogData(data);
                        saveAllToLocal();
                        renderBlog();
                    }
                });
            }
            const save = function () {
                const data = getBlogData();
                const idx = Array.from(blogGrid.children).indexOf(card);
                if (data[idx]) {
                    data[idx].date = stripBom(card.querySelector('.card-date').textContent);
                    data[idx].title = stripBom(card.querySelector('h3').textContent);
                    data[idx].content = stripBom(card.querySelector('p').textContent);
                    saveBlogData(data);
                    saveAllToLocal();
                }
            };
            card.querySelector('.card-date')?.addEventListener('blur', save);
            card.querySelector('h3')?.addEventListener('blur', save);
            card.querySelector('p')?.addEventListener('blur', save);
        });
    }

    // =====================
    // GITHUB API (xuất bản + xóa ảnh)
    // =====================
    const GH_TOKEN_KEY = 'blog_gh_token';
    const GH_REPO_KEY = 'blog_gh_repo';
    const DELETED_FILES_KEY = 'blog_deleted_files';
    const GH_UPLOAD_DIR = 'assets/uploads';

    function showGithubModal(step) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'gh-modal-overlay';
            const label1 = step === 1 ? 'GitHub Token (PAT)' : 'Token đã lưu';
            const val1 = step === 1 ? '' : (localStorage.getItem(GH_TOKEN_KEY) || '');
            overlay.innerHTML = `
                <div class="gh-modal-box">
                    <h3>${step === 1 ? 'Nhập thông tin GitHub' : 'Xác nhận GitHub'}</h3>
                    <label>${label1}</label>
                    <input type="text" class="gh-modal-token" value="${escapeHtml(val1)}" placeholder="ghp_xxxxxxxxxxxx" autocomplete="off" autocorrect="off" spellcheck="false">
                    <label>Tên repo (vd: username/repo)</label>
                    <input type="text" class="gh-modal-repo" value="${escapeHtml(localStorage.getItem(GH_REPO_KEY) || '')}" placeholder="username/repo" autocomplete="off">
                    <div class="gh-modal-actions">
                        <button class="gh-modal-cancel">Hủy</button>
                        <button class="gh-modal-ok">Đồng ý</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector('.gh-modal-token').focus();
            const close = (result) => { overlay.remove(); resolve(result); };
            const submit = () => {
                const token = overlay.querySelector('.gh-modal-token').value.trim();
                const repo = overlay.querySelector('.gh-modal-repo').value.trim();
                if (!token || !repo) { overlay.remove(); resolve(null); return; }
                localStorage.setItem(GH_TOKEN_KEY, token);
                localStorage.setItem(GH_REPO_KEY, repo);
                close({ token, repo });
            };
            overlay.querySelector('.gh-modal-ok').addEventListener('click', submit);
            overlay.querySelector('.gh-modal-cancel').addEventListener('click', () => close(null));
            overlay.addEventListener('click', function (e) { if (e.target === overlay) close(null); });
            overlay.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        });
    }

    function getDeletedFiles() {
        try { return JSON.parse(localStorage.getItem(DELETED_FILES_KEY)) || []; } catch { return []; }
    }

    function addDeletedFile(filename) {
        if (!filename || filename.startsWith('data:')) return;
        const list = getDeletedFiles();
        if (!list.includes(filename)) {
            list.push(filename);
            localStorage.setItem(DELETED_FILES_KEY, JSON.stringify(list));
        }
    }

    function clearDeletedFiles() {
        localStorage.removeItem(DELETED_FILES_KEY);
    }

    function generateImageFilename(originalName) {
        const ext = (originalName.split('.').pop() || 'jpg').toLowerCase();
        return 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '.' + ext;
    }

    function extractGitHubPath(url) {
        try {
            const parts = new URL(url).pathname.split('/').filter(Boolean);
            return parts.slice(3).join('/');
        } catch { return null; }
    }

    async function ghUploadImage(token, repo, ghPath, base64Content) {
        let sha = null;
        try {
            const res = await fetch('https://api.github.com/repos/' + repo + '/contents/' + ghPath, {
                headers: { Authorization: 'token ' + token }
            });
            if (res.ok) { const d = await res.json(); sha = d.sha; }
        } catch {}
        const body = { message: 'Upload ảnh: ' + ghPath.split('/').pop(), content: base64Content, branch: 'main' };
        if (sha) body.sha = sha;
        const res = await fetch('https://api.github.com/repos/' + repo + '/contents/' + ghPath, {
            method: 'PUT',
            headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Upload thất bại [HTTP ' + res.status + ']');
        }
    }

    async function ghDeleteFile(token, repo, ghPath) {
        const res = await fetch('https://api.github.com/repos/' + repo + '/contents/' + ghPath, {
            headers: { Authorization: 'token ' + token }
        });
        if (res.status === 404) return;
        if (!res.ok) throw new Error('Không lấy được sha của ' + ghPath + ' (HTTP ' + res.status + ')');
        const d = await res.json();
        const sha = d.sha;
        const delRes = await fetch('https://api.github.com/repos/' + repo + '/contents/' + ghPath, {
            method: 'DELETE',
            headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Xóa ' + ghPath, sha: sha, branch: 'main' })
        });
        if (!delRes.ok) {
            const err = await delRes.json().catch(() => ({}));
            throw new Error((err.message || 'Lỗi xóa') + ' [' + ghPath + ' - HTTP ' + delRes.status + ']');
        }
    }

    async function ensureGithubToken() {
        let token = localStorage.getItem(GH_TOKEN_KEY);
        let repo = localStorage.getItem(GH_REPO_KEY);
        if (token && repo) return { token, repo };
        const result = await showGithubModal(1);
        return result;
    }

    // =====================
    // PUBLISH
    // =====================
    async function publishToGitHub() {
        if (!isAdmin) return;
        publishBtn.disabled = true;
        try {
            saveAllToLocal();
            const siteData = {};
            editables.forEach(el => {
                const f = el.dataset.field;
                if (f) siteData[f] = getEditableText(el);
            });
            const galleryData = getGalleryData();
            const postsData = getBlogData();
            const deletedFiles = getDeletedFiles();

            let token = localStorage.getItem(GH_TOKEN_KEY);
            let repo = localStorage.getItem(GH_REPO_KEY);
            if (!token || !repo) {
                const result = await showGithubModal(2);
                if (!result) { publishBtn.disabled = false; publishStatus.textContent = ''; return; }
                token = result.token;
                repo = result.repo;
            }

            const pendingImages = galleryData.filter(item => item.src && item.src.startsWith('data:'));
            const totalSteps = 2 + deletedFiles.length + pendingImages.length;
            let step = 0;

            // Upload ảnh pending
            for (let i = 0; i < galleryData.length; i++) {
                if (galleryData[i].src && galleryData[i].src.startsWith('data:')) {
                    step++;
                    publishStatus.textContent = step + '/' + totalSteps + ' - Đang tải ảnh ' + (i + 1) + '/' + pendingImages.length + '...';
                    const b64 = galleryData[i].src.split(',')[1];
                    const fname = generateImageFilename('img_' + i + '_' + Date.now() + '.jpg');
                    await ghUploadImage(token, repo, GH_UPLOAD_DIR + '/' + fname, b64);
                    galleryData[i].src = 'https://raw.githubusercontent.com/' + repo + '/main/' + GH_UPLOAD_DIR + '/' + fname;
                }
            }
            saveGalleryData(galleryData);

            // Save content
            step++;
            publishStatus.textContent = step + '/' + totalSteps + ' - Đang lưu vào GitHub...';
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ site: siteData, gallery: galleryData, posts: postsData })
            });
            const result = await res.json();
            if (!result.ok) throw new Error(result.error || 'Lỗi server');

            // Xóa ảnh đã đánh dấu
            for (const file of deletedFiles) {
                step++;
                publishStatus.textContent = step + '/' + totalSteps + ' - Đang xóa ' + file + '...';
                try {
                    await ghDeleteFile(token, repo, file);
                } catch (e) {
                    console.warn('Không xóa được ' + file + ':', e.message);
                }
            }
            clearDeletedFiles();

            publishStatus.innerHTML = '✓ Đã xuất bản thành công! <span style="opacity:0.6;font-size:0.7rem;margin-left:4px;">Reload trang để xem</span>';
            setTimeout(() => { publishStatus.textContent = ''; }, 6000);
        } catch (err) {
            console.error('Publish error:', err);
            let msg = err.message;
            if (err.message.includes('401') || err.message.includes('403')) {
                localStorage.removeItem(GH_TOKEN_KEY);
                msg = 'Token sai/hết hạn. Hãy nhập lại token mới.';
            } else if (err.message.includes('404')) {
                msg = 'Repo không tồn tại. Kiểm tra lại tên repo (username/repo).';
            } else if (err.message.includes('422')) {
                msg = 'File quá lớn hoặc bị trùng. Thử giảm kích thước ảnh.';
            } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                msg = 'Lỗi mạng. Kiểm tra kết nối internet.';
            }
            publishStatus.innerHTML = '✗ Lỗi: ' + escapeHtml(msg) + ' <span style="opacity:0.6;font-size:0.7rem;margin-left:4px;">[F12 xem chi tiết]</span>';
        }
        publishBtn.disabled = false;
    }

    publishBtn.addEventListener('click', publishToGitHub);

    // =====================
    // LOAD INITIAL DATA
    // =====================
    async function initData() {
        try {
            const [siteRes, galRes, postRes] = await Promise.all([
                fetch('content/site.json' + CACHE_BUST),
                fetch('content/gallery.json' + CACHE_BUST),
                fetch('content/posts.json' + CACHE_BUST)
            ]);
            if (!siteRes.ok || !galRes.ok || !postRes.ok) throw new Error('Load JSON failed');

            const site = await siteRes.json();
            const gal = await galRes.json();
            const posts = await postRes.json();

            editables.forEach(el => {
                const f = el.dataset.field;
                if (f && site[f] !== undefined) el.innerHTML = sanitizeForDisplay(site[f]);
            });

            try { localStorage.setItem(GALLERY_KEY, JSON.stringify(gal)); } catch {}
            try { localStorage.setItem(BLOG_KEY, JSON.stringify(posts)); } catch {}
            try {
                localStorage.setItem('blog_data', JSON.stringify({
                    ...Object.fromEntries(editables.map(el => [el.dataset.field, getEditableText(el)]).filter(([k]) => k)),
                    _gallery: gal,
                    _posts: posts
                }));
            } catch {}
            renderGallery();
            renderBlog();
            console.log('Đã tải dữ liệu từ server');
            return;
        } catch (e) {
            console.warn('Không thể tải từ JSON:', e.message);
        }

        if (loadFromLocal()) {
            console.log('Sử dụng dữ liệu từ localStorage');
            renderGallery();
            renderBlog();
            return;
        }

        saveGalleryData([
            { src: '473057845_1324967375323197_7691148311523062675_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '504265715_1430961278057139_4805018946062274658_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '491459297_18017679221700444_2378959171536059656_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '605118719_1586492995837299_3830246236406655843_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '592877601_2682534062088980_2711140852549492742_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '672171537_1674591990360732_9109967491958179765_n.jpg', note: 'Ghi chú về hình xăm này...' }
        ]);
        saveBlogData([
            { date: 'Ngày tháng', title: 'Tiêu đề bài viết 1', content: 'Nội dung...' },
            { date: 'Ngày tháng', title: 'Tiêu đề bài viết 2', content: 'Nội dung...' },
            { date: 'Ngày tháng', title: 'Tiêu đề bài viết 3', content: 'Nội dung...' }
        ]);
        renderGallery();
        renderBlog();
    }

    initData();

    // =====================
    // EFFECTS (scroll reveal, parallax, counter)
    // =====================
    function smoothScrollTo(target) {
        const targetY = target.getBoundingClientRect().top + window.pageYOffset - 80;
        const startY = window.pageYOffset;
        const diff = targetY - startY;
        if (Math.abs(diff) < 1) return;
        const duration = Math.min(Math.abs(diff) * 0.4, 800);
        let start = null;
        function step(ts) {
            if (!start) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
            window.scrollTo(0, startY + diff * ease);
            if (progress < 1) window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
    }

    document.querySelectorAll('.main-nav a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const t = document.querySelector(this.getAttribute('href'));
            if (t) smoothScrollTo(t);
        });
    });

    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.main-nav a');
    window.addEventListener('scroll', () => {
        const sy = window.scrollY + 200;
        sections.forEach(s => {
            const top = s.offsetTop, h = s.offsetHeight, id = s.getAttribute('id');
            navLinks.forEach(l => {
                l.style.color = '';
                l.style.borderColor = '';
                if (l.getAttribute('href') === `#${id}` && sy >= top && sy < top + h) {
                    l.style.color = 'var(--gold)';
                    l.style.borderColor = 'var(--gold)';
                }
            });
        });
    });

    window.addEventListener('scroll', () => {
        const h = document.querySelector('.header-content');
        if (h && window.scrollY < window.innerHeight) {
            h.style.transform = `translateY(${window.scrollY * 0.4}px)`;
            h.style.opacity = 1 - (window.scrollY / window.innerHeight) * 0.5;
        }
    });

    function animateCounter(el) {
        const text = el.textContent.trim();
        const target = parseInt(text);
        if (isNaN(target) || target === 0) return;
        const start = performance.now();
        const duration = 1500;
        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target) + (text.includes('+') ? '+' : '');
            if (progress < 1) requestAnimationFrame(update);
            else el.textContent = text;
        }
        requestAnimationFrame(update);
    }

    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add('revealed');
            revealObserver.unobserve(el);
            if (el.classList.contains('stat-number')) {
                animateCounter(el);
            } else {
                el.querySelectorAll('.stat-number').forEach(animateCounter);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('[data-reveal]').forEach(el => {
        if (!el.classList.contains('revealed')) revealObserver.observe(el);
    });
});
