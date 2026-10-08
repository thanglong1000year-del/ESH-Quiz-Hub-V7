# ESH Quiz Hub V7

Nền tảng/khung quiz **đa môn**: mỗi môn học là một không gian dữ liệu hoàn
toàn độc lập (giáo viên Sinh học, Lịch sử, v.v. đều có thể dùng app này để tự
xây ngân hàng câu hỏi, lớp học, bài làm riêng của môn mình — không chia sẻ
với môn khác).

V7 được xây mới hoàn toàn từ bài học của **ESH Quiz Hub V6.3.8** (bản chỉ
dành riêng cho Toán 6/7, 1 trường) — xem đầy đủ bối cảnh, quyết định và lộ
trình tại [tài liệu kiến trúc](https://claude.ai/code/artifact/7498db22-07cb-4170-ba3b-7a9315f21d88).

## Nguyên tắc cốt lõi

1. **Cô lập hoàn toàn theo môn học** (`subjectId`) — không khoá cứng môn học
   trong code như V6.3.8 (`math6-question-bank.tsx`, `curriculum-structure.ts`).
2. **"Xây phần thô, giáo viên tự hoàn thiện"** — Owner dựng nền tảng (đăng
   nhập, vai trò, tạo môn học, luồng làm bài/chấm điểm, báo cáo, backup,
   design system); giáo viên tự soạn câu hỏi/đề thi, tự quản lý lớp/học sinh
   trong môn mình, không cần Owner duyệt từng bước.
3. **Không fallback phân quyền theo domain email** (rủi ro bảo mật đã có ở
   V6.3.8) — mọi quyền đều tường minh qua `role`/`teacherRole` trong
   `/users/{uid}`. Mỗi môn có đúng 1 giáo viên **admin** (do Owner tạo, toàn
   quyền) và có thể có nhiều giáo viên **viewer** (được admin mời, chỉ xem
   đúng 1 lớp — xem `docs/DATA_MODEL.md`).
4. **Có môi trường sandbox cho dev** — `vite dev` mặc định nối Firebase
   Emulator Suite, không bao giờ đụng dữ liệu production (V6.3.8 thiếu điều
   này hoàn toàn).
5. **Vòng đời dữ liệu theo năm học** — dữ liệu `schoolYear` (lớp, học sinh,
   kết quả...) được archive read-only 6 tháng rồi mới xoá vĩnh viễn; ngân
   hàng câu hỏi và khung chương trình giữ nguyên qua các năm.
6. **Kiểm tra tự động cơ bản cho câu hỏi** giáo viên tự soạn (định dạng, đáp
   án hợp lệ, trùng lặp) — không cần Owner duyệt tay từng câu, nhưng vẫn chặn
   lỗi rõ ràng.

Chi tiết schema: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).
Hướng dẫn chạy dev: [`docs/DEV_SETUP.md`](docs/DEV_SETUP.md).

## Trạng thái hiện tại

**Giai đoạn 0 (nền tảng) — xong.** **Giai đoạn 1 (core tự chủ giáo viên) — xong phần làm bài trắc nghiệm.**

- [x] Cấu trúc project (Vite + React + TypeScript + Tailwind)
- [x] Firestore schema tổng quát hoá theo môn (`docs/DATA_MODEL.md`)
- [x] Firestore Rules cô lập hoàn toàn theo `subjectId`
- [x] Firebase Emulator Suite mặc định cho dev
- [x] Cloud Function kiểm tra tự động câu hỏi (`functions/src/validateQuestion.ts`)
- [x] Cloud Function đóng năm học + archive + purge theo lịch
- [x] Đăng nhập, điều hướng theo vai trò (Owner/Teacher), design system cơ bản
- [x] Ngân hàng câu hỏi — UI soạn/sửa/xoá (thùng rác) câu hỏi trắc nghiệm & tự luận, hiển thị trạng thái kiểm tra tự động
- [x] Quản lý lớp/học sinh — tạo lớp theo năm học, thêm học sinh hàng loạt
- [x] Đề bài — giáo viên chọn câu hỏi từ ngân hàng, đặt thời gian mở/đóng, chia sẻ link
- [x] Học sinh làm bài qua link công khai (tài khoản ẩn danh, không cần đăng ký) — chấm điểm trắc nghiệm **server-side** qua Cloud Function `submitAssignment` để không lộ đáp án đúng cho client
- [x] Giáo viên xem kết quả bài làm theo đề
- [x] Bài tập tự luận — tick học sinh đã nộp bài theo từng tuần (không chấm điểm/nhận xét, kế thừa mô hình đã sửa ở V6.3.8)
- [x] Owner tạo tài khoản giáo viên **admin** trực tiếp từ UI (Cloud Function `createTeacherAdmin` — tạo tài khoản Auth thật + trả mật khẩu tạm 1 lần, không cần tạo tay qua Firebase Console nữa)
- [x] Giáo viên admin mời thêm giáo viên **viewer** xem đúng 1 lớp (đăng nhập bằng Gmail cá nhân, chỉ xem — không sửa; xem thử đề không ghi nhận kết quả) — xem mục "Mời giáo viên xem lớp" trong `docs/DATA_MODEL.md`
- [ ] ~~Điểm danh~~ (đã bỏ khỏi phạm vi theo quyết định của Owner — không triển khai)
- [ ] Báo cáo/campaign PDF + email (để Giai đoạn sau theo lộ trình đã chốt)

### Lưu ý khi deploy production

- **Bật Anonymous Authentication** trong Firebase Console → Authentication →
  Sign-in method — bắt buộc để học sinh làm bài qua link công khai (không cần
  tài khoản).
- **Bật Google Sign-In** (cùng mục trên) — bắt buộc để giáo viên **viewer**
  được mời đăng nhập bằng Gmail cá nhân.

Emulator Suite đã bật sẵn cả hai, không cần làm gì thêm khi dev.

## Stack kỹ thuật

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication, Cloud Functions v2, Hosting)
- **Dev**: Firebase Emulator Suite (bắt buộc cho mọi thay đổi trước khi đụng production)

## Bắt đầu nhanh

```bash
npm install
cp .env.example .env.local   # điền config Firebase thật (xem Firebase Console)

# Terminal 1: chạy emulator
firebase emulators:start

# Terminal 2: seed dữ liệu giả + chạy frontend
node scripts/seed-emulator.mjs
npm run dev
```

Đăng nhập thử: `owner@esh.test` / `password123` (Owner) hoặc
`teacher-sinh@esh.test` / `password123` (giáo viên môn Sinh học mẫu).
