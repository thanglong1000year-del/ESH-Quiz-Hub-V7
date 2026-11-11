# Data Model — ESH Quiz Hub V7

## Nguyên tắc cốt lõi

1. **Mỗi môn học (`subject`) là một không gian dữ liệu cô lập hoàn toàn.**
   Giáo viên môn Sinh học và giáo viên môn Lịch sử không bao giờ thấy, đọc, hay
   dùng chung bất kỳ dữ liệu nào của nhau — kể cả khi họ cùng dùng chung 1 app,
   1 Firebase project. Đây **không phải** mô hình "nhiều giáo viên chia sẻ ngân
   hàng câu hỏi trong cùng 1 môn".
2. **Trong 1 môn có 2 vai trò giáo viên** (field `teacherRole` ở `/users/{uid}`
   — xem mục "Mời giáo viên xem lớp" dưới): **"admin"** (do Owner tạo, toàn
   quyền) và **"viewer"** (do admin mời, chỉ xem đúng 1 lớp). App này dành
   riêng cho giáo viên bộ môn — không có khái niệm giáo viên chủ nhiệm ở cấp
   trường trong hệ thống.
3. **Mọi document "theo năm học" đều gắn `schoolYear`** (ví dụ `"2027-2028"`),
   để hỗ trợ quy trình đóng năm học (archive → xoá) mà không đụng tới dữ liệu
   bền vững (ngân hàng câu hỏi, khung chương trình, tài khoản).
4. **Không có fallback phân quyền theo domain email** (bài học từ
   `firestore.rules` của V6.3.8 — đã gây rủi ro bảo mật). Mọi quyền truy cập
   đều tường minh qua `role`/`teacherRole` trong `/users/{uid}` đối chiếu
   `request.auth.uid`.

## Cây collection (Firestore, top-level)

```
/platformConfig/{singleton}         # Owner cấu hình chung: thang điểm, thời gian mặc định, theme
/users/{uid}                        # role: "owner" | "teacher"; nếu teacher: teacherRole "admin"|"viewer" + subjectId (+ viewerClassId nếu viewer)
/teacherInvites/{email}              # lời mời giáo viên xem-lớp còn hiệu lực (xem mục dưới) — top-level, id = email chuẩn hoá
/mail/{id}                           # hàng đợi gửi email (quy ước Firebase Extension "Trigger Email") — chỉ Cloud Function ghi
/subjects/{subjectId}                # tên môn, ownerTeacherId, trạng thái, schoolYearCurrent
  /curriculum/{nodeId}               # khung chương trình của môn (bền vững, không theo năm)
  /questionBank/{questionId}         # ngân hàng câu hỏi (bền vững, không theo năm)
  /classes/{classId}                 # lớp — gắn schoolYear
    /students/{studentId}            # có thêm studentEmail/parentEmails (tuỳ chọn, cho Báo cáo/campaign)
    /writtenWeeks/{weekId}           # tuần có giao bài tự luận (xem mục dưới)
    /writtenSubmissions/{studentId}  # tick nộp/chưa nộp bài tự luận theo tuần
    /reportCampaigns/{campaignId}    # Báo cáo/campaign — xem mục dưới
  /assignments/{assignmentId}        # đề/bài giao — gắn schoolYear
  /submissions/{submissionId}        # bài làm/kết quả — gắn schoolYear
  /attendance/{recordId}             # điểm danh — gắn schoolYear
  /archives/{schoolYear}             # snapshot báo cáo tổng kết khi đóng năm học
```

Mọi document dưới `/subjects/{subjectId}/**` kế thừa cô lập qua `subjectId` lấy
từ path — rules chỉ cần kiểm `ownerTeacherId` của subject cha khớp
`request.auth.uid` (hoặc role `owner`).

## Trường bắt buộc theo loại dữ liệu

| Loại | Trường bắt buộc | Vòng đời |
|---|---|---|
| `subjects/*` | `ownerTeacherId`, `name`, `status`, `createdAt` | Bền vững |
| `questionBank/*` | `subjectId`, `createdBy`, `validation.status` | Bền vững |
| `curriculum/*` | `subjectId` | Bền vững |
| `classes/*`, `students/*` | `subjectId`, `schoolYear` | Theo năm học |
| `assignments/*`, `submissions/*`, `attendance/*` | `subjectId`, `schoolYear` | Theo năm học |

## Đề bài & nộp bài — tách biệt dữ liệu "an toàn" khỏi "nhạy cảm"

`assignments/{id}` lưu `questionsSnapshot`: bản sao các câu hỏi đã **lược bỏ
đáp án đúng** (`correctOptionIds`) — đây là dữ liệu duy nhất học sinh (tài
khoản ẩn danh, không có hồ sơ `/users/{uid}`) được phép đọc trực tiếp, và chỉ
khi `status == "published"` (xem `firestore.rules`).

Nộp bài **không đi qua client Firestore write**. Học sinh gọi Cloud Function
callable `submitAssignment` (`functions/src/submitAssignment.ts`), function
này dùng Admin SDK đọc câu hỏi gốc (có đáp án đúng) để chấm điểm, rồi mới ghi
document `submissions/*` — đáp án đúng không bao giờ rời khỏi server. Câu tự
luận không tự chấm được, lưu lại chờ giáo viên chấm tay (chưa có UI ở bản
hiện tại).

## Bài tập tự luận — tick nộp bài theo tuần (không chấm điểm)

Mô hình này **kế thừa trực tiếp bản sửa lại ở V6.3.8**
(`written-submission-data.ts`/`WrittenSubmissionPanel.tsx`): giáo viên
KHÔNG viết nhận xét hay cho điểm câu tự luận — chỉ tick học sinh đã nộp bài
hay chưa theo từng tuần (tối đa 34 tuần/năm học). Hoàn toàn độc lập với
`assignments`/`submissions` (đề trắc nghiệm) ở trên; không liên quan tới
câu hỏi loại `"essay"` trong ngân hàng câu hỏi.

- `writtenWeeks/{weekId}` (`weekId = "w" + số tuần, ví dụ "w05"`): khai báo
  tuần nào lớp này có giao bài tự luận — quyết định cột nào hiện ra trên
  bảng tick. `{ week, title?, schoolYear, classId, subjectId, createdAt }`.
- `writtenSubmissions/{studentId}` (id = trùng `studentId`, mỗi học sinh
  đúng 1 document/lớp): `{ weeks: Record<string tuần, boolean> }` — field
  `weeks` được ghi bằng `setDoc(..., {merge: true})` nên Firestore tự deep-
  merge map lồng, mỗi lần tick chỉ cần gửi đúng 1 tuần thay đổi.

So với V6.3.8 (collection phẳng cấp toàn trường, phải ghép
năm học+khối+lớp+tuần thành 1 id dài), V7 đơn giản hơn: lưu trực tiếp dưới
`classes/{classId}` vì lớp đã tự mang `subjectId`+`schoolYear`, không cần
trường "khối" (V7 không khoá cứng khối lớp theo môn).

## Mời giáo viên xem lớp (viewer)

Quyết định 2026-10-08: mỗi môn có đúng **1 giáo viên admin** (do Owner tạo,
toàn quyền) và có thể mời thêm **nhiều giáo viên viewer** — mỗi viewer chỉ
xem (không sửa) đúng **1 lớp** được gán: danh sách học sinh, đề trắc nghiệm
(xem + làm thử không ghi nhận kết quả), kết quả/tiến độ nộp bài (trắc
nghiệm + tự luận theo tuần). Không có ngân hàng câu hỏi (chứa đáp án đúng),
không tạo/sửa/xoá gì.

**Tạo admin (Owner thực hiện)** — Cloud Function `createTeacherAdmin`
(`functions/src/createTeacherAdmin.ts`, Admin SDK): tạo 1 tài khoản Firebase
Auth email/password thật + document `subjects/{subjectId}` + hồ sơ
`/users/{uid}` (`teacherRole: "admin"`) trong 1 lượt gọi. Mật khẩu tạm được
trả về **một lần duy nhất** cho Owner tự gửi (app chưa có hệ thống email).
Thay cho quy trình thủ công cũ (tạo tay trên Firebase Console/Auth rồi dán
UID).

**Mời viewer (admin thực hiện, tự phục vụ — không cần Owner)**:
1. Admin nhập Gmail + chọn lớp trên `ClassDetailPage` → ghi trực tiếp
   `teacherInvites/{email}` (`status: "pending"`, `subjectId`, `classId`,
   `invitedBy`) — Firestore rules chỉ cho admin của đúng `subjectId` tạo.
2. Giáo viên được mời bấm "Đăng nhập bằng Google" (`LoginPage.tsx`) —
   **dùng Gmail cá nhân, không có mật khẩu riêng do app cấp**.
3. Ngay sau khi đăng nhập Google, client gọi Cloud Function
   `claimTeacherInvite` (`functions/src/claimTeacherInvite.ts`, Admin SDK).
   Function dùng **email đã xác thực từ token đăng nhập**
   (`request.auth.token.email`, không phải email client tự khai) để tra
   `teacherInvites/{email}`; nếu tìm thấy và còn `"pending"`, tạo
   `/users/{uid}` (`teacherRole: "viewer"`, `subjectId`, `viewerClassId`)
   và đánh dấu lời mời `"accepted"`. Nếu không tìm thấy → báo lỗi rõ ràng
   ("chưa được mời"), không tạo gì.

Vì bước nhận lời mời khớp theo **email đã xác thực** (không phải uid — uid
của Firebase Auth cho tài khoản Google chỉ sinh ra ở lần đăng nhập đầu
tiên, trước đó hệ thống không thể biết trước), `teacherInvites` phải là
collection **top-level** (không nằm dưới `subjects/{subjectId}`) để Cloud
Function tra được ngay bằng `doc(email)` mà không cần biết trước
`subjectId`.

**Làm thử đề không ghi nhận kết quả**: Cloud Function `previewAssignment`
(`functions/src/previewAssignment.ts`) dùng lại logic chấm của
`submitAssignment` (xem `functions/src/gradeAssignment.ts`) để trả về điểm +
đúng/sai từng câu, nhưng **không ghi gì vào `submissions`** — tự kiểm tra
quyền trong function (đúng `subjectId`, viewer phải đúng `classId`) vì
Admin SDK bỏ qua Firestore Rules.

**Lưu ý deploy production**: phải bật **Google Sign-In** trong Firebase
Console → Authentication → Sign-in method (ngoài Anonymous Authentication
đã có) để giáo viên viewer đăng nhập được.

## Link "Theo dõi tiến độ" cho phụ huynh — kênh mặc định, miễn phí

Quyết định 2026-11-01: V6.3.8 gặp vấn đề chi phí với báo cáo gửi tự động
(dữ liệu tăng dần, vượt mức miễn phí). Kênh chính của V7 là **kéo (pull)**
thay vì **đẩy (push)**: mỗi học sinh có 1 `viewToken` ngẫu nhiên (128 bit,
tạo khi thêm học sinh), giáo viên bấm "Copy link phụ huynh" trên
`ClassDetailPage` để lấy sẵn 1 tin nhắn kèm link và tự dán vào Zalo/SMS/
email — app không gửi gì, không cần SMTP, không tốn phí tin nhắn.

- Link: `/progress/{subjectId}/{classId}/{studentId}/{viewToken}` →
  `ParentProgressPage` gọi callable `getStudentProgress` (Admin SDK, không
  cần đăng nhập). Function so khớp token (timing-safe), chỉ trả số liệu
  tổng hợp của đúng học sinh đó (điểm từng bài, tick tự luận theo tuần) —
  không có câu hỏi/đáp án, Firestore Rules không phải mở quyền đọc công khai.
- Chi phí: chỉ đọc Firestore khi phụ huynh thực sự mở link (~5 lượt đọc
  + số bài đã làm), không quét định kỳ toàn bộ học sinh.
- "Đổi link" = tạo `viewToken` mới, link cũ lập tức hết hiệu lực (dùng khi
  gửi nhầm người).

## Đăng nhập phụ huynh bằng email/mật khẩu — kênh thứ 2, chống giả mạo link

Quyết định 2026-11-01: lừa đảo gửi link giả mạo đang phổ biến, nên bên cạnh
link `viewToken` ở trên, V7 thêm kênh phụ huynh tự đăng ký tài khoản email/
mật khẩu trên chính app — không phụ thuộc vào 1 đường link nhận qua Zalo/
SMS. Route công khai `/parent/login` (`ParentLoginPage.tsx`), dashboard
`/parent` (`ParentDashboardPage.tsx`, yêu cầu đăng nhập qua `RequireAuth`).

- Đăng ký (`createUserWithEmailAndPassword`) → Firebase gửi email xác
  minh (`sendEmailVerification`) → phụ huynh bấm link xác minh → đăng nhập
  lại → client gọi callable `syncParentProfile`.
- `syncParentProfile` (Admin SDK) BẮT BUỘC `request.auth.token.email_verified
  === true` (dùng email đã xác thực từ token, không dùng email client tự
  khai — giống `claimTeacherInvite` với Google Sign-In), rồi quét
  `collectionGroup("students")` theo `parentEmails` (`array-contains` — mảng
  vì 1 học sinh có thể có nhiều email phụ huynh, ví dụ cả bố và mẹ cùng
  đăng nhập được; field này tự động được đánh index đơn, không cần cấu
  hình thêm `firestore.indexes.json`). Mỗi học sinh khớp được tạo thành 1
  `ParentChildRef` (tên hiển thị only, không có số liệu), ghi vào
  `/users/{uid}` với `role: "parent"`.
- Email luôn được chuẩn hoá chữ thường khi LƯU (teacher nhập qua
  `bulk-import.ts`/`updateStudentContact`) và khi SO KHỚP (`syncParentProfile`,
  `getChildProgressForParent`) — Firestore `where ==` không tự so sánh
  không phân biệt hoa/thường.
- Xem số liệu 1 con: callable `getChildProgressForParent` — nhận
  `{subjectId, classId, studentId}`, tự đọc lại `parentEmails` hiện tại của
  đúng học sinh đó và so với email đã xác thực của người gọi; KHÔNG tin
  danh sách `children` lưu trên `/users/{uid}` (chỉ dùng để vẽ UI, có thể
  cũ nếu giáo viên vừa đổi email phụ huynh) — nên dù dữ liệu hiển thị cũ,
  không thể đọc được dữ liệu học sinh đã bị đổi/xoá email phụ huynh.
- 2 callable trên và `getStudentProgress` (link `viewToken`) dùng chung
  phần tổng hợp số liệu ở `functions/src/progressView.ts` — tránh lặp code,
  mỗi callable chỉ tự chịu trách nhiệm phần xác thực quyền truy cập riêng.
- Không cần sửa `firestore.rules`: phụ huynh không bao giờ đọc Firestore
  trực tiếp từ client (trừ chính `/users/{uid}` của họ, đã được phép đọc
  theo rule có sẵn `request.auth.uid == uid`) — mọi số liệu đi qua callable.

### Đăng nhập phụ huynh bằng Google — kênh thứ 3, mang từ V6.3.8 sang

Quyết định 2026-11-11: V6.3.8 (production) vừa thêm "Phụ huynh đăng nhập
Google" bên cạnh link theo dõi tiến độ — mang sang V7 làm kênh thứ 3,
song song (không thay thế) kênh email/mật khẩu ở trên.

- `ParentLoginPage.tsx` thêm nút "Đăng nhập bằng Google" (`signInParentWithGoogle`
  trong `parent-auth.ts`): `signInWithPopup(auth, new GoogleAuthProvider())`
  rồi gọi lại đúng `syncParentProfile` đã có — **không cần Cloud Function
  mới, không cần sửa `firestore.rules`**, vì `syncParentProfile` đã kiểm
  `request.auth.token.email`/`email_verified` theo token, không theo
  provider (Google hay email/mật khẩu).
- Không cần bước xác minh email: token Google luôn có `email_verified:
  true` sẵn, nên `syncParentProfile` chấp nhận ngay sau lần bấm đầu — nhanh
  hơn kênh email/mật khẩu (phải chờ phụ huynh mở email xác minh).
- Dùng chung `auth` chính của app (giống Google Sign-In của giáo viên ở
  `LoginPage.tsx`), KHÔNG dựng Firebase app phụ như V6.3.8 đã phải làm —
  lý do V6.3.8 cần tách là vì trang chủ của nó có 1 `onAuthStateChanged`
  lớn dùng chung cho mọi vai trò, còn V7 đã tách `/parent/login` thành
  route riêng và định tuyến vai trò qua hồ sơ `/users/{uid}` (`auth-context.tsx`),
  nên không có xung đột nào để tránh.
- **Lưu ý deploy production**: đã bật Google Sign-In cho giáo viên (mục
  trên) thì kênh này dùng lại đúng cấu hình đó, không cần bật thêm gì ở
  Firebase Console → Authentication → Sign-in method.

## Báo cáo/campaign — nhắc giờ gửi email (tuỳ chọn)

Chỉ dùng khi trường muốn đẩy email chủ động và chấp nhận cài extension
"Trigger Email" + nhà cung cấp SMTP. Không bắt buộc — link theo dõi tiến độ
ở trên đã đủ để phụ huynh nắm tình hình.

Tính năng lớn còn thiếu so với V6.3.8 (`report-campaign-*`), viết lại cho
kiến trúc đa môn — xem `functions/src/reportCampaign.ts`.

- `classes/{classId}/reportCampaigns/{campaignId}`: `{ title, recipientMode:
  "student"|"parent"|"both", scheduledAt, status: "scheduled"|"running"|
  "sent"|"failed", lastError?, lastRunAt?, targetCount?, sentCount?,
  skippedStudentIds? }`. Client chỉ tạo (`status: "scheduled"`) và xoá; đổi
  `status`/ghi `lastError` CHỈ do Cloud Function (Admin SDK) thực hiện
  (`allow update: if false` trong rules).
- Hai đường chạy dùng chung logic (`runReportCampaign`): callable
  `runReportCampaignNow` (admin bấm "Gửi ngay") và `scheduledReportCampaignRun`
  (`onSchedule`, quét mỗi 15 phút mọi chiến dịch `status == "scheduled"` đã
  tới `scheduledAt`, qua `collectionGroup`).
- Nội dung báo cáo mỗi học sinh: điểm trung bình trắc nghiệm (khớp theo
  `studentName` trong `submissions` — **hạn chế đã biết**: bài làm ẩn danh
  chỉ lưu tên tự nhập, không có `studentId`, nên 2 học sinh trùng tên trong
  1 lớp sẽ bị gộp điểm, giống cách `AssignmentResultsPage` đang hiển thị) +
  tỉ lệ nộp bài tự luận theo tuần (`writtenSubmissions`).
- Gửi email qua collection top-level `mail` theo đúng quy ước của **Firebase
  Extension "Trigger Email"** (`{ to: string[], message: { subject, html } }`)
  — Owner cần tự cài extension này trên project Firebase thật (Firebase
  Console → Extensions) kèm cấu hình SMTP/SendGrid, app không tự gửi email
  trực tiếp.
- **2 bài học rút ra từ lỗi thật của V6.3.8** (đã điều tra ở phiên
  2026-10-26): (1) KHÔNG đánh fail toàn bộ chiến dịch chỉ vì 1-2 học sinh
  thiếu email — chỉ học sinh đó bị bỏ qua (`skippedStudentIds`), các em còn
  lại vẫn nhận được báo cáo; (2) `lastError` PHẢI hiển thị rõ trên
  `ReportCampaignsPage.tsx` — V6.3.8 có ghi lý do lỗi thật vào Firestore
  nhưng UI (`ReportCampaignPanel.tsx`) chưa bao giờ hiện ra, khiến giáo viên
  không biết vì sao chiến dịch fail.
- Học sinh/phụ huynh cần được khai báo `studentEmail`/`parentEmails` trên
  `ClassDetailPage` (nút "Email" cạnh mỗi học sinh) trước khi có thể nhận
  báo cáo — chiến dịch bỏ qua (không fail) học sinh nào thiếu cả 2 email
  phù hợp với `recipientMode` đã chọn.

## Quy trình đóng năm học (tham khảo)

Xem `functions/src/yearRollover.ts` — chạy khi Owner kích hoạt, theo đúng 4
bước đã chốt trong kế hoạch kiến trúc: xuất báo cáo → archive read-only X
tháng (mặc định 6, cấu hình ở `platformConfig.archiveRetentionMonths`) → xoá
vĩnh viễn sau khi hết hạn → giữ nguyên dữ liệu bền vững.
