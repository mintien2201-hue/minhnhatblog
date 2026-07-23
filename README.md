# Blog Cá Nhân - Tattoo Artist Portfolio

Website portfolio cá nhân với tính năng chỉnh sửa trực tiếp và xuất bản lên GitHub Pages.

## Tính năng

- ✏️ Chỉnh sửa nội dung trực tiếp trên trang web (chỉ admin)
- 🖼️ Quản lý gallery hình ảnh (upload lên GitHub, tự nén ảnh)
- 📝 Quản lý bài viết blog (thêm/sửa/xóa)
- 🔒 Bảo vệ bằng mật khẩu + JWT
- 🚀 Xuất bản lên GitHub Pages tự động
- 🗑️ Xóa ảnh trên GitHub khi xóa khỏi gallery (không rác)
- 👥 Phân biệt: visitor (chỉ xem) vs admin (có nút bút chì chỉnh sửa)

## Cách sử dụng

### 1. Chạy local (dev)
```bash
# Cài env
cp .env.example .env
# Sửa .env: SITE_PASSWORD, JWT_SECRET, GITHUB_TOKEN, GITHUB_REPO

# Chạy
npm run dev
# → http://localhost:3000
```

### 2. Trang người xem
- Vào `http://localhost:3000` → xem nội dung
- Không thấy nút bút chì, không thể chỉnh sửa

### 3. Trang admin
- Vào `http://localhost:3000/login.html`
- Nhập mật khẩu → chuyển về trang chủ
- Góc phải dưới hiện nút **✏️** → click để bật edit mode
- Sửa nội dung → click **Xuất bản** để lưu lên GitHub

### 4. Deploy lên Vercel
1. Push code lên GitHub
2. Vào Vercel → New Project → import repo
3. Environment Variables (bắt buộc):
   - `SITE_PASSWORD` — mật khẩu admin
   - `JWT_SECRET` — random string ≥32 ký tự
   - `GITHUB_TOKEN` — PAT có scope `repo`
   - `GITHUB_REPO` — dạng `username/repo`
   - `NEXT_PUBLIC_SITE_URL` — URL Vercel (vd `https://blogcanhan.vercel.app`)

## 🔐 BẢO MẬT QUAN TRỌNG

### Tạo GitHub Personal Access Token

1. Vào GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token (classic)
4. Chọn scope: **repo** (toàn bộ quyền repository)
5. Copy token ngay (chỉ hiển thị 1 lần duy nhất)

### Lưu trữ token an toàn

**✅ ĐÚNG:**
- Lưu vào Password Manager (1Password, Bitwarden, LastPass)
- Lưu vào file text riêng tư, không commit
- Sử dụng Windows Credential Manager
- Bật chế độ "Nhập token mỗi lần" trong cài đặt (nút ⚙️)

**❌ SAI:**
- Lưu trong code
- Commit vào Git
- Gửi qua email/chat
- Để trong git remote URL
- Share công khai

### Quản lý token trong ứng dụng

Click nút **⚙️** (Settings) ở góc dưới để:

1. **Xem thông tin token hiện tại** (chỉ hiển thị một phần)
2. **Xóa token** - Khuyến nghị khi không sử dụng
3. **Nhập lại token mới** - Khi token cũ hết hạn
4. **Bật/tắt chế độ "Nhập token mỗi lần"** - An toàn nhất, không lưu token

### Token bị lộ - Phải làm gì?

Nếu token bị lộ ra ngoài (commit nhầm, share nhầm):

1. **Xóa token ngay trên GitHub:**
   - Settings → Developer settings → Personal access tokens
   - Tìm token và click Delete

2. **Tạo token mới**

3. **Cập nhật git remote nếu cần:**
   ```bash
   git remote set-url origin https://github.com/username/repo.git
   ```

4. **Xóa token cũ khỏi ứng dụng:**
   - Click nút ⚙️ → Chọn "1. Xóa token"

## Cấu trúc dự án

```
blogcanhan/
├── index.html          # Trang chính
├── style.css          # Giao diện
├── script.js          # Logic chính
├── content/           # Data JSON (tự động tạo khi xuất bản)
│   ├── site.json
│   ├── gallery.json
│   └── posts.json
├── assets/
│   └── uploads/       # Ảnh upload (tự động tạo)
└── *.jpg              # Ảnh mẫu
```

## Đổi mật khẩu

Mật khẩu mặc định: `123456`

Để đổi, mở `script.js` và sửa dòng 4:
```javascript
const DEFAULT_PASSWORD = 'mat_khau_moi_cua_ban';
```

## Deploy lên GitHub Pages

1. Push code lên GitHub repository
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: `main` → `/ (root)` → Save
5. Đợi vài phút → truy cập `https://username.github.io/repo-name`

## Hỗ trợ

Nếu gặp vấn đề:
- Kiểm tra Console (F12) để xem lỗi
- Đảm bảo token có quyền `repo`
- Đảm bảo tên repo đúng định dạng `username/repo`

## License

MIT License - Tự do sử dụng và chỉnh sửa
