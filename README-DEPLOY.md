# Bieng Cafe 2D — bộ deploy Render

Thư mục này là **bản rút gọn để đưa lên Render**: chỉ gồm những gì server online cần.
Không có `runtime/` (60 MB binary Windows), không có model SketchUp.

```
onerender/
├─ server/server.py        # HTTP + WebSocket + bảng tin + quản trị
├─ static/                 # toàn bộ client (HTML/CSS/JS/Phaser/layout)
├─ data/community.json     # dữ liệu mẫu (bài + lời nhắn) — sẽ reset khi restart
├─ requirements.txt        # websockets
├─ render.yaml             # cấu hình deploy tự động
└─ .gitignore
```

## 1. Đưa lên GitHub (5 phút)

```bash
cd onerender
git init
git add .
git commit -m "Bieng Cafe 2D - ban deploy Render"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/<tên-repo>.git
git push -u origin main
```

Repo **private** cũng được, Render vẫn đọc được khi bạn cấp quyền.

## 2. Tạo service trên Render (3 phút)

**Cách nhanh (dùng `render.yaml`):**
1. Vào https://dashboard.render.com → **New +** → **Blueprint**
2. Chọn repo vừa push → Render đọc `render.yaml` và tạo service `bieng-cafe`
3. Bấm **Apply**

**Cách thủ công (nếu không dùng Blueprint):**
1. **New +** → **Web Service** → chọn repo
2. Language: **Python**
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `python server/server.py --host 0.0.0.0 --port $PORT`
5. Instance Type: **Free** → **Create Web Service**

Sau ~2 phút bạn có địa chỉ `https://bieng-cafe-xxxx.onrender.com` (HTTPS + WebSocket có sẵn).

## 3. Điều cần biết ở gói Free

| Điều | Ảnh hưởng |
|---|---|
| Ngủ sau 15 phút không có traffic | Người mở đầu tiên chờ 30–60 giây. Khi có người chơi, client gửi `move` liên tục nên server không ngủ |
| Ổ đĩa tạm | `data/community.json` reset về bản mẫu sau mỗi lần deploy/restart. Bài/lời nhắn người chơi tạo sẽ mất, bài mẫu quay lại |
| 750 giờ/tháng | Một service chạy 24/7 ≈ 730 giờ → vừa đủ, đừng tạo thêm service free thứ hai |

Client đã có **tự kết nối lại** (`static/js/network.js`): server ngủ hay mạng rớt thì tự nối lại, không cần F5.

## 4. Cập nhật tính năng

```bash
# sửa code trong thư mục này, rồi:
git add .
git commit -m "mô tả thay đổi"
git push
```

Render tự build và deploy lại (zero-downtime ở gói trả phí). Sửa `static/**` thì người chơi chỉ cần Ctrl+F5; sửa `server/**` thì service restart.

## 5. Mật khẩu quản trị

Đang là **20101995** (hằng `ADMIN_PASSWORD` trong `server/server.py`).
Bản test thì giữ được, nhưng **trước khi công khai rộng phải đổi** — ai đọc repo cũng biết.

## 6. Nếu sau này muốn trả phí (giữ dữ liệu + không ngủ)

1. Đổi Instance Type sang **Starter** (~$7/tháng).
2. Thêm **Disk** 1 GB (~$0,25/tháng), mount path `/var/data`.
3. Sửa Start Command:

```bash
python server/server.py --host 0.0.0.0 --port $PORT --data-dir /var/data
```

Khi đó `data/` nằm trên disk, bảng tin và mặt bằng đã xuất bản không mất nữa.

## 7. Kiểm tra sau khi deploy

```
https://<tên-service>.onrender.com/api/health      → {"app":"bieng-cafe-2d-portable","version":"3.1",...}
https://<tên-service>.onrender.com/api/community   → có 2 bài + 2 lời nhắn mẫu
https://<tên-service>.onrender.com/                → vào quán
```

Nếu trang trắng: chờ thêm 30 giây (cold start) rồi tải lại. Nếu vẫn lỗi, xem tab **Logs** của service trên Render.
