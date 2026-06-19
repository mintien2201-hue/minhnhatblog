document.addEventListener('DOMContentLoaded', function() {

    const PASSWORD_KEY = 'blog_pass';
    const DEFAULT_PASSWORD = '123456';

    // GitHub config — user nhập 1 lần, lưu localStorage
    const GH_TOKEN_KEY = 'blog_gh_token';
    const GH_REPO_KEY = 'blog_gh_repo';

    let isEditing = false;

    // DOM
    const editBtn = document.getElementById('editToggle');
    const passModal = document.getElementById('passwordModal');
    const passInput = document.getElementById('passwordInput');
    const passConfirm = document.getElementById('passwordConfirm');
    const passCancel = document.getElementById('passwordCancel');
    const passError = document.getElementById('passwordError');
    const fileInput = document.getElementById('fileInput');
    const galleryGrid = document.getElementById('gallery-grid');
    const blogGrid = document.getElementById('blog-grid');
    const publishBtn = document.getElementById('publishBtn');
    const publishStatus = document.getElementById('publishStatus');
    const editables = document.querySelectorAll('[contenteditable]');

    // =====================
    // PASSWORD
    // =====================
    function getPassword() {
        return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
    }

    // =====================
    // EDIT MODE
    // =====================
    function enableEditing(on) {
        isEditing = on;
        editables.forEach(el => el.setAttribute('contenteditable', on ? 'true' : 'false'));
        editBtn.textContent = on ? '🔓' : '🔒';
        editBtn.classList.toggle('active', on);
        document.body.classList.toggle('edit-mode', on);
        if (!on) saveAllToLocal();
        renderGallery();
        renderBlog();
    }

    editBtn.addEventListener('click', function() {
        if (isEditing) { enableEditing(false); }
        else { showPassModal(); }
    });

    function showPassModal() {
        passModal.classList.add('show');
        passInput.value = '';
        passError.classList.remove('show');
        passInput.focus();
    }

    function hidePassModal() {
        passModal.classList.remove('show');
    }

    passConfirm.addEventListener('click', function() {
        if (passInput.value.trim() === getPassword()) {
            hidePassModal();
            enableEditing(true);
        } else {
            passError.classList.add('show');
            passInput.value = '';
            passInput.focus();
        }
    });

    passInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') passConfirm.click();
        if (e.key === 'Escape') hidePassModal();
    });

    passCancel.addEventListener('click', hidePassModal);
    passModal.addEventListener('click', function(e) {
        if (e.target === this) hidePassModal();
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
        // Gallery & posts
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

    // Auto-save on input
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
                <img src="${item.src}" alt="Tác phẩm" loading="lazy">
                <div class="gallery-overlay">
                    <span class="gallery-note" contenteditable="${isEditing}">${item.note || ''}</span>
                </div>
                <button class="item-delete" data-type="gallery" title="Xoá">✕</button>
            `;
            galleryGrid.appendChild(div);
        });
        // Add btn
        const add = document.createElement('div');
        add.className = 'add-btn add-btn-gallery';
        add.textContent = '+ Thêm tác phẩm';
        add.addEventListener('click', () => fileInput.click());
        galleryGrid.appendChild(add);
        attachGalleryEvents();
    }

    function attachGalleryEvents() {
        document.querySelectorAll('#gallery-grid .gallery-item').forEach(item => {
            // Delete
            const del = item.querySelector('.item-delete');
            if (del) {
                del.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const data = getGalleryData();
                    const idx = Array.from(galleryGrid.children).indexOf(item);
                    if (idx > -1) { data.splice(idx, 1); saveGalleryData(data); saveAllToLocal(); renderGallery(); }
                });
            }
            // Note save
            const note = item.querySelector('.gallery-note');
            if (note) {
                note.addEventListener('blur', function() {
                    const data = getGalleryData();
                    const idx = Array.from(galleryGrid.children).indexOf(item);
                    if (data[idx]) { data[idx].note = this.innerHTML; saveGalleryData(data); saveAllToLocal(); }
                });
            }
            // Lightbox
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

    // File upload
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = getGalleryData();
            data.push({ src: e.target.result, note: 'Ghi chú...' });
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
                <a href="#" class="read-more">Đọc tiếp</a>
                <button class="item-delete" title="Xoá">✕</button>
            `;
            blogGrid.appendChild(article);
        });
        const add = document.createElement('div');
        add.className = 'add-btn add-btn-blog';
        add.textContent = '+ Thêm bài viết';
        add.addEventListener('click', function() {
            const data = getBlogData();
            data.push({ date: 'Ngày tháng', title: 'Tiêu đề', content: 'Nội dung...' });
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
    // PUBLISH TO GITHUB
    // =====================
    publishBtn.addEventListener('click', publishToGitHub);
    
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn.addEventListener('click', showSecuritySettings);

    function showSecuritySettings() {
        const token = localStorage.getItem(GH_TOKEN_KEY);
        const repo = localStorage.getItem(GH_REPO_KEY);
        const alwaysAsk = localStorage.getItem('blog_always_ask_token') === 'true';
        
        let msg = 'CÀI ĐẶT BẢO MẬT\n\n';
        
        if (token && repo) {
            msg += `Repo hiện tại: ${repo}\n`;
            msg += `Token: ${token.substring(0, 8)}...${token.substring(token.length - 4)}\n`;
            msg += `Chế độ: ${alwaysAsk ? 'Nhập token mỗi lần' : 'Lưu token'}\n\n`;
            msg += 'Chọn:\n';
            msg += '1. Xóa token (khuyến nghị khi không dùng)\n';
            msg += '2. Nhập lại token mới\n';
            msg += `3. ${alwaysAsk ? 'Tắt' : 'Bật'} chế độ nhập token mỗi lần (an toàn hơn)\n`;
            msg += '4. Hủy';
            
            const choice = prompt(msg);
            
            if (choice === '1') {
                if (confirm('Xóa token và repo khỏi trình duyệt?')) {
                    localStorage.removeItem(GH_TOKEN_KEY);
                    localStorage.removeItem(GH_REPO_KEY);
                    alert('Đã xóa token. Lần xuất bản tiếp theo sẽ yêu cầu nhập lại.');
                }
            } else if (choice === '2') {
                localStorage.removeItem(GH_TOKEN_KEY);
                localStorage.removeItem(GH_REPO_KEY);
                alert('Đã xóa token cũ. Click "Xuất bản lên GitHub" để nhập token mới.');
            } else if (choice === '3') {
                const newValue = !alwaysAsk;
                localStorage.setItem('blog_always_ask_token', newValue.toString());
                if (newValue) {
                    localStorage.removeItem(GH_TOKEN_KEY);
                    alert('Đã bật chế độ nhập token mỗi lần.\nToken sẽ KHÔNG được lưu trong trình duyệt.');
                } else {
                    alert('Đã tắt chế độ nhập token mỗi lần.\nToken sẽ được lưu để dùng lại.');
                }
            }
        } else {
            msg += 'Chưa có token được lưu.\n\n';
            msg += 'Chọn:\n';
            msg += `1. ${alwaysAsk ? 'Tắt' : 'Bật'} chế độ nhập token mỗi lần\n`;
            msg += '2. Hủy';
            
            const choice = prompt(msg);
            
            if (choice === '1') {
                const newValue = !alwaysAsk;
                localStorage.setItem('blog_always_ask_token', newValue.toString());
                alert(newValue ? 
                    'Đã bật chế độ nhập token mỗi lần (an toàn hơn).' : 
                    'Đã tắt chế độ nhập token mỗi lần.');
            }
        }
    }

    async function publishToGitHub() {
        let token = localStorage.getItem(GH_TOKEN_KEY);
        let repo = localStorage.getItem(GH_REPO_KEY);

        // Tùy chọn: Nhập token mỗi lần (an toàn hơn)
        const alwaysAsk = localStorage.getItem('blog_always_ask_token') === 'true';

        if (!token || !repo || alwaysAsk) {
            if (!alwaysAsk) {
                const warning = 'CẢNH BÁO BẢO MẬT:\n\n' +
                    '• Token sẽ được lưu trong trình duyệt của bạn\n' +
                    '• KHÔNG chia sẻ token với ai\n' +
                    '• KHÔNG commit token vào code\n' +
                    '• Nhấn nút ⚙️ ở góc dưới để xóa token khi không dùng\n\n' +
                    'Tiếp tục?';
                
                if (!confirm(warning)) return;
            }
            
            token = prompt('Nhập GitHub Personal Access Token (cần quyền repo):\n\nĐể tạo token:\n1. GitHub → Settings → Developer settings\n2. Personal access tokens → Tokens (classic)\n3. Generate new token → chọn scope "repo"');
            if (!token) return;
            
            if (!repo) {
                repo = prompt('Nhập tên repo (vd: username/repo):');
                if (!repo) return;
            }
            
            if (!alwaysAsk) {
                localStorage.setItem(GH_TOKEN_KEY, token);
                localStorage.setItem(GH_REPO_KEY, repo);
            } else {
                // Chỉ lưu repo, không lưu token
                localStorage.setItem(GH_REPO_KEY, repo);
            }
        }

        publishBtn.disabled = true;
        publishStatus.textContent = 'Đang xuất bản...';

        try {
            saveAllToLocal();

            // Thu thập data
            const siteData = {};
            editables.forEach(el => {
                const f = el.dataset.field;
                if (f) siteData[f] = el.innerHTML;
            });

            const galleryData = getGalleryData();
            const postsData = getBlogData();

            // Chuyển ảnh data URL trong gallery sang file uploads
            // (data URL ảnh mới thêm sẽ được upload lên assets/uploads)
            const finalGallery = [];
            for (const item of galleryData) {
                if (item.src.startsWith('data:')) {
                    // Upload lên GitHub và lấy URL
                    const uploaded = await uploadImageToGitHub(item.src, token, repo);
                    finalGallery.push({ ...item, src: uploaded });
                } else {
                    finalGallery.push(item);
                }
            }

            // Commit site.json
            await commitFile(token, repo, 'content/site.json', JSON.stringify(siteData, null, 2));

            // Commit gallery.json
            await commitFile(token, repo, 'content/gallery.json', JSON.stringify(finalGallery, null, 2));

            // Commit posts.json
            await commitFile(token, repo, 'content/posts.json', JSON.stringify(postsData, null, 2));

            publishStatus.textContent = 'Đã xuất bản! Trang sẽ cập nhật sau vài phút.';
            setTimeout(() => { publishStatus.textContent = ''; }, 4000);

        } catch (err) {
            publishStatus.textContent = 'Lỗi: ' + err.message;
            console.error(err);
        }

        publishBtn.disabled = false;
    }

    async function commitFile(token, repo, path, content) {
        // Lấy SHA của file hiện tại nếu tồn tại
        let sha = null;
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
                headers: { Authorization: `token ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                sha = data.sha;
            }
        } catch (e) {}

        const body = {
            message: `Cập nhật ${path} từ blog`,
            content: btoa(unescape(encodeURIComponent(content))),
            branch: 'main'
        };
        if (sha) body.sha = sha;

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Lỗi GitHub API');
        }
    }

    async function uploadImageToGitHub(dataUrl, token, repo) {
        // Tạo tên file
        const ext = dataUrl.split(';')[0].split('/')[1] || 'png';
        const name = `upload_${Date.now()}.${ext}`;
        const path = `assets/uploads/${name}`;

        const base64 = dataUrl.split(',')[1];

        const body = {
            message: `Thêm ảnh ${name}`,
            content: base64,
            branch: 'main'
        };

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error('Upload ảnh thất bại: ' + (err.message || ''));
        }

        const data = await res.json();
        return data.content.download_url || `https://raw.githubusercontent.com/${repo}/main/${path}`;
    }

    // =====================
    // LOAD INITIAL DATA
    // =====================
    async function initData() {
        // Thử load từ JSON files trước (khi deploy)
        try {
            const [siteRes, galRes, postRes] = await Promise.all([
                fetch('content/site.json'), fetch('content/gallery.json'), fetch('content/posts.json')
            ]);
            const site = await siteRes.json();
            const gal = await galRes.json();
            const posts = await postRes.json();

            // Áp dụng lên DOM
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

        // Fallback: load từ localStorage
        if (loadFromLocal()) {
            renderGallery();
            renderBlog();
            return;
        }

        // Không có gì — render mẫu
        saveGalleryData([
            { src: '473057845_1324967375323197_7691148311523062675_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '504265715_1430961278057139_4805018946062274658_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '491459297_18017679221700444_2378959171536059656_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '605118719_1586492995837299_3830246236406655843_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '592877601_2682534062088980_2711140852549492742_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '672171537_1674591990360732_9109967491958179765_n.jpg', note: 'Ghi chú về hình xăm này...' },
            { src: '476312251_1343620190124582_4690998580177942908_n.jpg', note: 'Ghi chú về hình xăm này...' }
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
    // EFFECTS
    // =====================
    // Smooth scroll
    document.querySelectorAll('.main-nav a[href^="#"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const t = document.querySelector(this.getAttribute('href'));
            if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Scroll reveal
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

    // Active nav
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

    // Parallax
    window.addEventListener('scroll', () => {
        const h = document.querySelector('.header-content');
        if (h && window.scrollY < window.innerHeight) {
            h.style.transform = `translateY(${window.scrollY * 0.4}px)`;
            h.style.opacity = 1 - (window.scrollY / window.innerHeight) * 0.5;
        }
    });

    // Counter
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
