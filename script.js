document.addEventListener('DOMContentLoaded', function() {

    let isEditing = false;

    // =====================
    // LOGIN CHECK
    // =====================
    const loggedIn = sessionStorage.getItem('blog_logged_in');
    const adminControls = document.getElementById('adminControls');

    if (!loggedIn) {
        adminControls.style.display = 'none';
    } else {
        adminControls.style.display = '';
    }

    // DOM
    const editBtn = document.getElementById('editToggle');
    const publishBtn = document.getElementById('publishBtn');
    const publishStatus = document.getElementById('publishStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    const fileInput = document.getElementById('fileInput');
    const galleryGrid = document.getElementById('gallery-grid');
    const blogGrid = document.getElementById('blog-grid');
    const editables = document.querySelectorAll('[contenteditable]');

    // =====================
    // LOGOUT
    // =====================
    logoutBtn.addEventListener('click', function() {
        sessionStorage.removeItem('blog_logged_in');
        enableEditing(false);
        adminControls.style.display = 'none';
    });

    // =====================
    // EDIT MODE
    // =====================
    function enableEditing(on) {
        isEditing = on;
        editables.forEach(el => el.setAttribute('contenteditable', on ? 'true' : 'false'));
        editBtn.textContent = on ? '✓' : '✏️';
        editBtn.classList.toggle('active', on);
        document.body.classList.toggle('edit-mode', on);
        if (!on) saveAllToLocal();
        renderGallery();
        renderBlog();
    }

    editBtn.addEventListener('click', function() {
        if (!sessionStorage.getItem('blog_logged_in')) return;
        enableEditing(!isEditing);
    });

    // =====================
    // LOCAL STORAGE SAVE/LOAD
    // =====================
    function saveAllToLocal() {
        const data = {};
        editables.forEach(el => {
            const field = el.dataset.field;
            if (field) data[field] = el.innerHTML;
        });
        data._gallery = getGalleryData();
        data._posts = getBlogData();
        localStorage.setItem('blog_data', JSON.stringify(data));
    }

    function loadFromLocal() {
        try {
            const saved = JSON.parse(localStorage.getItem('blog_data'));
            if (!saved) return false;
            editables.forEach(el => {
                const field = el.dataset.field;
                if (field && saved[field] !== undefined) el.innerHTML = saved[field];
            });
            if (saved._gallery) { saveGalleryData(saved._gallery); renderGallery(); }
            if (saved._posts) { saveBlogData(saved._posts); renderBlog(); }
            return true;
        } catch (e) { return false; }
    }

    document.addEventListener('input', function(e) {
        if (e.target.getAttribute('contenteditable') === 'true') {
            saveAllToLocal();
        }
    });

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

    function renderGallery() {
        const data = getGalleryData();
        galleryGrid.innerHTML = '';
        data.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.setAttribute('data-index', i);
            div.innerHTML = `
                <img src="${item.src}" alt="Tac pham" loading="lazy">
                <div class="gallery-overlay">
                    <span class="gallery-note" contenteditable="${isEditing}">${item.note || ''}</span>
                </div>
                <button class="item-delete" data-type="gallery" title="Xoa">✕</button>
            `;
            galleryGrid.appendChild(div);
        });
        const add = document.createElement('div');
        add.className = 'add-btn add-btn-gallery';
        add.textContent = '+ Them tac pham';
        add.addEventListener('click', () => fileInput.click());
        galleryGrid.appendChild(add);
        attachGalleryEvents();
    }

    function attachGalleryEvents() {
        document.querySelectorAll('#gallery-grid .gallery-item').forEach(item => {
            const del = item.querySelector('.item-delete');
            if (del) {
                del.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const data = getGalleryData();
                    const idx = Array.from(galleryGrid.children).indexOf(item);
                    if (idx > -1) { data.splice(idx, 1); saveGalleryData(data); saveAllToLocal(); renderGallery(); }
                });
            }
            const note = item.querySelector('.gallery-note');
            if (note) {
                note.addEventListener('blur', function() {
                    const data = getGalleryData();
                    const idx = Array.from(galleryGrid.children).indexOf(item);
                    if (data[idx]) { data[idx].note = this.innerHTML; saveGalleryData(data); saveAllToLocal(); }
                });
            }
            item.addEventListener('click', function(e) {
                if (e.target.closest('.item-delete') || e.target.getAttribute('contenteditable') === 'true') return;
                const img = this.querySelector('img');
                const note = this.querySelector('.gallery-note');
                if (!img) return;
                const ov = document.createElement('div');
                ov.className = 'lightbox';
                ov.innerHTML = `
                    <div class="lightbox-bg"></div>
                    <div class="lightbox-content">
                        <img src="${img.src}" alt="" class="lightbox-img">
                        <div class="lightbox-note">${note ? note.innerHTML : ''}</div>
                    </div>
                    <button class="lightbox-close">✕</button>
                `;
                document.body.appendChild(ov);
                document.body.style.overflow = 'hidden';
                setTimeout(() => ov.classList.add('active'), 10);
                const close = () => { ov.classList.remove('active'); setTimeout(() => { ov.remove(); document.body.style.overflow = ''; }, 300); };
                ov.querySelector('.lightbox-close').addEventListener('click', close);
                ov.addEventListener('click', function(e) { if (e.target === this) close(); });
                document.addEventListener('keydown', function h(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', h); } });
            });
        });
    }

    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = getGalleryData();
            data.push({ src: e.target.result, note: 'Ghi chu...' });
            saveGalleryData(data); saveAllToLocal(); renderGallery();
        };
        reader.readAsDataURL(file);
        this.value = '';
    });

    // =====================
    // BLOG
    // =====================
    const BLOG_KEY = 'blog_posts';

    function getBlogData() {
        try { return JSON.parse(localStorage.getItem(BLOG_KEY)) || []; } catch { return []; }
    }

    function saveBlogData(data) {
        localStorage.setItem(BLOG_KEY, JSON.stringify(data));
    }

    function renderBlog() {
        const data = getBlogData();
        blogGrid.innerHTML = '';
        data.forEach((post, i) => {
            const article = document.createElement('article');
            article.className = 'blog-card';
            article.innerHTML = `
                <div class="card-date" contenteditable="${isEditing}">${post.date || ''}</div>
                <h3 contenteditable="${isEditing}">${post.title || ''}</h3>
                <p contenteditable="${isEditing}">${post.content || ''}</p>
                <a href="#" class="read-more">Doc tiep</a>
                <button class="item-delete" title="Xoa">✕</button>
            `;
            blogGrid.appendChild(article);
        });
        const add = document.createElement('div');
        add.className = 'add-btn add-btn-blog';
        add.textContent = '+ Them bai viet';
        add.addEventListener('click', function() {
            const data = getBlogData();
            data.push({ date: 'Ngay thang', title: 'Tieu de', content: 'Noi dung...' });
            saveBlogData(data); saveAllToLocal(); renderBlog();
        });
        blogGrid.appendChild(add);
        attachBlogEvents();
    }

    function attachBlogEvents() {
        document.querySelectorAll('#blog-grid .blog-card').forEach(card => {
            const del = card.querySelector('.item-delete');
            if (del) {
                del.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const data = getBlogData();
                    const idx = Array.from(blogGrid.children).indexOf(card);
                    if (idx > -1) { data.splice(idx, 1); saveBlogData(data); saveAllToLocal(); renderBlog(); }
                });
            }
            const save = function() {
                const data = getBlogData();
                const idx = Array.from(blogGrid.children).indexOf(card);
                if (data[idx]) {
                    data[idx].date = card.querySelector('.card-date').innerHTML;
                    data[idx].title = card.querySelector('h3').innerHTML;
                    data[idx].content = card.querySelector('p').innerHTML;
                    saveBlogData(data); saveAllToLocal();
                }
            };
            card.querySelector('.card-date')?.addEventListener('blur', save);
            card.querySelector('h3')?.addEventListener('blur', save);
            card.querySelector('p')?.addEventListener('blur', save);
        });
    }

    // =====================
    // PUBLISH VIA GITHUB API
    // =====================
    const GH_TOKEN_KEY = 'blog_gh_token';
    const GH_REPO_KEY = 'blog_gh_repo';

    async function publishToGitHub() {
        publishBtn.disabled = true;
        publishStatus.textContent = 'Dang xuat ban...';

        try {
            saveAllToLocal();

            let token = localStorage.getItem(GH_TOKEN_KEY);
            let repo = localStorage.getItem(GH_REPO_KEY);

            if (!token || !repo) {
                token = prompt('Nhap GitHub Token (PAT):');
                if (!token) { publishBtn.disabled = false; publishStatus.textContent = ''; return; }
                repo = prompt('Nhap ten repo (vd: username/repo):');
                if (!repo) { publishBtn.disabled = false; publishStatus.textContent = ''; return; }
                localStorage.setItem(GH_TOKEN_KEY, token);
                localStorage.setItem(GH_REPO_KEY, repo);
            }

            const siteData = {};
            editables.forEach(el => {
                const f = el.dataset.field;
                if (f) siteData[f] = el.innerHTML;
            });
            const galleryData = getGalleryData();
            const postsData = getBlogData();

            await ghCommitFile(token, repo, 'content/site.json', JSON.stringify(siteData, null, 2));
            await ghCommitFile(token, repo, 'content/gallery.json', JSON.stringify(galleryData, null, 2));
            await ghCommitFile(token, repo, 'content/posts.json', JSON.stringify(postsData, null, 2));

            publishStatus.textContent = 'Da xuat ban thanh cong!';
            setTimeout(() => { publishStatus.textContent = ''; }, 4000);

        } catch (err) {
            publishStatus.textContent = 'Loi: ' + err.message;
            if (err.message.includes('401') || err.message.includes('403')) {
                localStorage.removeItem(GH_TOKEN_KEY);
                publishStatus.textContent = 'Token sai. Hay nhap lai.';
            }
            console.error(err);
        }
        publishBtn.disabled = false;
    }

    async function ghCommitFile(token, repo, path, content) {
        let sha = null;
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
                headers: { Authorization: 'token ' + token }
            });
            if (res.ok) { const d = await res.json(); sha = d.sha; }
        } catch {}

        const body = {
            message: 'Cap nhat ' + path,
            content: btoa(unescape(encodeURIComponent(content))),
            branch: 'main'
        };
        if (sha) body.sha = sha;

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'GitHub API loi ' + res.status);
        }
    }

    publishBtn.addEventListener('click', publishToGitHub);

    // =====================
    // LOAD INITIAL DATA
    // =====================
    async function initData() {
        try {
            const [siteRes, galRes, postRes] = await Promise.all([
                fetch('content/site.json'), fetch('content/gallery.json'), fetch('content/posts.json')
            ]);
            const site = await siteRes.json();
            const gal = await galRes.json();
            const posts = await postRes.json();

            editables.forEach(el => {
                const f = el.dataset.field;
                if (f && site[f] !== undefined) el.innerHTML = site[f];
            });
            saveGalleryData(gal);
            saveBlogData(posts);
            saveAllToLocal();
            renderGallery();
            renderBlog();
            return;
        } catch (e) {}

        if (loadFromLocal()) {
            renderGallery();
            renderBlog();
            return;
        }

        saveGalleryData([
            { src: '473057845_1324967375323197_7691148311523062675_n.jpg', note: 'Ghi chu ve hinh xam nay...' },
            { src: '504265715_1430961278057139_4805018946062274658_n.jpg', note: 'Ghi chu ve hinh xam nay...' },
            { src: '491459297_18017679221700444_2378959171536059656_n.jpg', note: 'Ghi chu ve hinh xam nay...' },
            { src: '605118719_1586492995837299_3830246236406655843_n.jpg', note: 'Ghi chu ve hinh xam nay...' },
            { src: '592877601_2682534062088980_2711140852549492742_n.jpg', note: 'Ghi chu ve hinh xam nay...' },
            { src: '672171537_1674591990360732_9109967491958179765_n.jpg', note: 'Ghi chu ve hinh xam nay...' },
            { src: '476312251_1343620190124582_4690998580177942908_n.jpg', note: 'Ghi chu ve hinh xam nay...' }
        ]);
        saveBlogData([
            { date: 'Ngay thang', title: 'Tieu de bai viet 1', content: 'Noi dung...' },
            { date: 'Ngay thang', title: 'Tieu de bai viet 2', content: 'Noi dung...' },
            { date: 'Ngay thang', title: 'Tieu de bai viet 3', content: 'Noi dung...' }
        ]);
        renderGallery();
        renderBlog();
    }

    initData();

    // =====================
    // EFFECTS
    // =====================
    document.querySelectorAll('.main-nav a[href^="#"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const t = document.querySelector(this.getAttribute('href'));
            if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '0';
                entry.target.style.transform = 'translateY(30px)';
                setTimeout(() => {
                    entry.target.style.transition = 'all 0.8s ease-out';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.blog-card, .gallery-item, .text-block, .contact-item').forEach(el => observer.observe(el));

    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.main-nav a');
    window.addEventListener('scroll', () => {
        const sy = window.scrollY + 200;
        sections.forEach(s => {
            const top = s.offsetTop, h = s.offsetHeight, id = s.getAttribute('id');
            navLinks.forEach(l => {
                l.style.color = ''; l.style.borderColor = '';
                if (l.getAttribute('href') === `#${id}` && sy >= top && sy < top + h) {
                    l.style.color = 'var(--gold)'; l.style.borderColor = 'var(--gold)';
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

    const statObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target, text = el.textContent.trim(), num = parseInt(text);
                if (!isNaN(num)) {
                    let cur = 0, inc = Math.ceil(num / 40);
                    const t = setInterval(() => {
                        cur += inc;
                        if (cur >= num) { el.textContent = text; clearInterval(t); }
                        else el.textContent = cur + (text.includes('+') ? '+' : '');
                    }, 40);
                }
                statObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('.stat-number').forEach(el => statObserver.observe(el));
});
