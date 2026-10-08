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
/subjects/{subjectId}                # tên môn, ownerTeacherId, trạng thái, schoolYearCurrent
  /curriculum/{nodeId}               # khung chương trình của môn (bền vững, không theo năm)
  /questionBank/{questionId}         # ngân hàng câu hỏi (bền vững, không theo năm)
  /classes/{classId}                 # lớp — gắn schoolYear
    /students/{studentId}
    /writtenWeeks/{weekId}           # tuần có giao bài tự luận (xem mục dưới)
    /writtenSubmissions/{studentId}  # tick nộp/chưa nộp bài tự luận theo tuần
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

## Quy trình đóng năm học (tham khảo)

Xem `functions/src/yearRollover.ts` — chạy khi Owner kích hoạt, theo đúng 4
bước đã chốt trong kế hoạch kiến trúc: xuất báo cáo → archive read-only X
tháng (mặc định 6, cấu hình ở `platformConfig.archiveRetentionMonths`) → xoá
vĩnh viễn sau khi hết hạn → giữ nguyên dữ liệu bền vững.
