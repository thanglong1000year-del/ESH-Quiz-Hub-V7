# Hướng dẫn chạy dev

## Yêu cầu

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Một Firebase project thật (dùng cho production sau này) — nhưng **dev hàng
  ngày không cần đụng tới nó**, nhờ Emulator Suite.

## Lần đầu

```bash
npm install
cd functions && npm install && cd ..
firebase login
firebase use --add   # chọn/gán Firebase project cho thư mục này
cp .env.example .env.local
```

Điền `.env.local` bằng config lấy từ Firebase Console → Project Settings →
Your apps. Với dev qua emulator, `apiKey`/`projectId` chỉ cần khớp định dạng,
không cần là giá trị thật 100% chính xác — nhưng nên dùng giá trị thật để dev
và production nhất quán.

## Chạy hàng ngày

```bash
# Terminal 1
firebase emulators:start

# Terminal 2 (lần đầu mỗi khi emulator khởi động lại dữ liệu trống)
node scripts/seed-emulator.mjs

# Terminal 2 (tiếp)
npm run dev
```

Mở `http://localhost:5173`. Mọi thao tác đều chạy trên Emulator Suite
(`http://localhost:4000` để xem Firestore/Auth emulator UI) — **không đụng
tới dữ liệu production**, dù chỉ 1 dòng.

## Deploy

```bash
npm run build
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

Luôn chạy `firebase deploy --only firestore:rules` riêng và kiểm tra kỹ mỗi
khi sửa `firestore.rules` — đây là lớp chặn cô lập dữ liệu giữa các môn, sai
sót ở đây có thể để lộ dữ liệu chéo.
