# KẾ HOẠCH: CHUYỂN BIENG CAFE 2D SANG GIAO DIỆN 3D ISOMETRIC

Mục tiêu: giữ **100% chức năng** hiện có (chat, bảng tin, mini game, thách đấu, rủ đi cùng, gửi xe, WC…) và **giữ nguyên pipeline SketchUp → JSON**, chỉ thay **lớp hiển thị** sang 3D isometric.

---

## 1. Nguyên tắc quyết định: "3D nhìn, 2D tính"

Toàn bộ gameplay hiện tại đang chạy trên **toạ độ phẳng 960×540**: va chạm, ghế, bãi xe, vùng tương tác, đồng bộ mạng… Nếu đổi sang 3D thật (vật lý 3D) thì phải viết lại gần như tất cả.

Cách rẻ nhất và an toàn nhất:

```
[ SketchUp ] → plugin Ruby → layout.json
                                   │
                    ┌──────────────┴───────────────┐
                    │                              │
             (A) Dữ liệu 2D                  (B) Hình khối 3D
        footprint, seat, zone            extrude từ tops[].z
                    │                              │
                    ▼                              ▼
             Game logic (giữ nguyên)      Three.js renderer (mới)
        va chạm, ghế, mạng, mini game     camera isometric, ánh sáng
```

- **Logic giữ nguyên 2D**: nhân vật vẫn có `x, y` trong mặt bằng, va chạm vẫn là hình chữ nhật 2D, server không đổi một dòng.
- **Renderer mới vẽ 3D**: mỗi polygon trong JSON được **đùn lên** theo chiều cao `z` (đơn vị inch) → tường, quầy, bàn, ghế thành khối 3D.
- Camera **orthographic** đặt góc isometric (≈ 45° ngang, 30–35° cao) → nhìn đúng kiểu "3D isometric", không méo phối cảnh.
- Nhân vật / xe vẫn là **sprite billboard** đứng trong không gian (giống game iso cổ điển), chỉ đổi vị trí theo phép chiếu.

→ Đổi renderer là **1 tệp mới**, bật/tắt bằng cờ `?renderer=3d` trong lúc chuyển, nên luôn quay lại bản 2D nếu lỗi.

---

## 2. Ba phương án (chọn 1)

| Phương án | Công sức | Rủi ro | Ghi chú |
|---|---|---|---|
| **A. 2.5D trên Phaser** (giữ Phaser, vẽ tile iso + sắp xếp depth) | 1–2 tuần | Thấp | Nhanh nhất nhưng vẫn là ảnh phẳng, không xoay được |
| **B. Three.js + logic 2D** (khuyến nghị) | 2–3 tuần | Trung bình | 3D thật, xoay/zoom nhẹ, giữ nguyên gameplay |
| **C. 3D toàn phần** (Three.js + vật lý 3D, viết lại gameplay) | 2–3 tháng | Rất cao | Mất gần hết code hiện tại |

**Khuyến nghị: B.** Giữ server, mạng, mini game, UI DOM, bảng tin, thách đấu — tất cả không đụng tới.

---

## 3. Những gì giữ nguyên / phải viết

### Giữ nguyên 100%
- `server/server.py` (HTTP + WebSocket + đấu + rủ đi cùng + dữ liệu).
- `static/index.html`, `ui.js` (HUD, modal, chat, menu, mini game DOM), `community.js`, `duel.js`, `ride.js`, `minigames.js`.
- Pipeline SketchUp: plugin Ruby xuất `bieng-layout.json` **không đổi**.
- Logic va chạm 2D, toạ độ ghế, bãi xe, vùng tương tác.

### Viết mới (1 lớp)
1. `static/js/iso3d/scene.js` — dựng Three.js: renderer, camera orthographic, ánh sáng, nền trời.
2. `static/js/iso3d/layout3d.js` — đọc `layout.json` → tạo mesh: đùn footprint theo `tops[].z`, gán màu theo `definition.color`, tường/cửa/glass.
3. `static/js/iso3d/actors.js` — nhân vật, xe, tên, bong bóng chat: sprite billboard + depth sort theo `y`.
4. `static/js/iso3d/picking.js` — click chuột → tia → mặt phẳng sàn → ra toạ độ 2D (giữ nguyên tap-to-move).
5. `static/js/iso3d/bridge.js` — cầu nối: nhận `player.x/y` mỗi frame từ `CafeScene` (2D) và cập nhật vị trí 3D; ngược lại chuyển click thành `targetPos` 2D.

### Sửa nhỏ
- `game.js`: tách phần **vẽ** khỏi phần **logic**. Hiện tại vẽ và logic trộn trong scene Phaser; chỉ cần bọc phần vẽ bằng `if (renderer === 'phaser') { ... }` và gọi `iso3d.sync(state)` mỗi frame.
- `index.html`: thêm `<canvas id="scene3d">` và nút chuyển "2D / 3D" để so sánh.

---

## 4. Chuyển toạ độ (công thức)

Layout JSON đã có sẵn phép chiếu 2D:
```
x = xOffset + (Y - modelYOrigin) * scale
y = yOffset + (X - modelXOrigin) * scale
```
Với 3D, dùng đơn vị **inch của SketchUp** trực tiếp (không cần `scale`), rồi đặt camera iso:
```
world = ( X, Z, Y )   // SketchUp: X ngang, Y sâu, Z cao
camera.position = (d, d * 0.8, d)  → lookAt(tâm quán)
camera = OrthographicCamera(-w/2, w/2, h/2, -h/2, 1, 5000)
```
Toạ độ 2D ↔ 3D khi cần (chọn vị trí nhân vật, ghế):
```
X = (px - xOffset) / scale + modelXOrigin
Y = (py - yOffset) / scale + modelYOrigin
Z = 0
```
Chỉ cần 2 hàm `to3D(px,py)` và `to2D(x,y)`.

---

## 5. Lộ trình 4 giai đoạn

| Giai đoạn | Việc | Thời gian | Kết quả kiểm chứng |
|---|---|---|---|
| **0. Spike** | Dựng Three.js đọc `bieng-layout.json`, hiện đúng hình khối quán, camera iso cố định | 1–2 ngày | Xoay/chụp được quán 3D, khớp hình 2D |
| **1. Renderer** | Mesh từ definitions + màu + cửa + kính; mặt sàn, bóng đổ nhẹ | 3–5 ngày | Đi trong quán thấy tường/quầy đúng chỗ |
| **2. Actors** | Nhân vật, xe, tên, chat bubble; depth sort; click-to-move; va chạm vẫn 2D | 3–5 ngày | Chơi được đầy đủ như bản 2D |
| **3. Đánh bóng** | Hiệu ứng mưa, đèn, hiệu năng điện thoại, nút chuyển 2D/3D | 3–5 ngày | 30–60 FPS trên điện thoại tầm trung |

Tổng: **2–3 tuần** làm đều, hoặc nhanh hơn nếu chia nhỏ theo buổi.

---

## 6. Rủi ro & cách chặn

| Rủi ro | Chặn trước |
|---|---|
| Máy yếu không chạy nổi 3D | Giữ nút chuyển về 2D; giới hạn đổ bóng, tắt antialias, dùng `InstancedMesh` |
| Nhân vật bị che sau tường | Depth sort theo `y` + làm mờ tường gần camera (`fade walls near camera`) |
| Click chọn sai vị trí | Raycast xuống mặt phẳng `Z=0` rồi mới đổi sang 2D |
| Kẹt va chạm khi hình 3D khác 2D | Va chạm vẫn dùng dữ liệu 2D gốc, 3D chỉ là hình |
| File nặng | Layout đã có sẵn ~79 KB; mesh sinh tại client, không tải model 3D ngoài (giữ bất biến "không CDN") |
| Thêm dependency | Three.js phải **tải về để trong `static/lib/`**, không dùng CDN (đúng quy ước repo) |

---

## 7. Đóng gói game ("gói toàn bộ lại")

| Cách | Ưu | Nhược |
|---|---|---|
| **ZIP portable** (đang có: `runtime\`, `.bat`, `static\`) | Đơn giản nhất, chạy offline ngay | Người nhận phải giải nén |
| **PWA** (thêm service worker) | Cài như app trên điện thoại, không cần store | Vẫn cần server chạy |
| **Electron** (~120 MB) | Một file `.exe`, có icon, cửa sổ riêng | Nặng, cần build cho từng HĐH |
| **PyInstaller** (đóng gói Python + server) | `.exe` nhỏ hơn Electron | Vẫn phải mở trình duyệt |

Khuyến nghị: **ZIP + PWA** giữ nguyên kiến trúc (không đổi code), sau này muốn `.exe` thì bọc Electron quanh bản zip là xong.

---

## 8. Hai câu cần chốt trước khi làm

1. **"3D isometric" của bạn là kiểu nào?**
   - (a) Góc cố định, chỉ nhìn nghiêng cho đẹp (như Stardew/SimCity 2000) → **rẻ, 2 tuần**
   - (b) Xoay 4 hướng như Sims, đồ vật thật sự có chiều cao → **đắt hơn ~1 tuần**, cần thêm hệ quay camera + sprite 4 hướng
2. **Đóng gói đích là gì?** ZIP chạy offline, PWA trên điện thoại, hay file `.exe`?
