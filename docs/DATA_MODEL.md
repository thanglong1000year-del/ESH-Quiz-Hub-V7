# Data Model — ESH Quiz Hub V7

## Nguyên tắc cốt lõi

1. **Mỗi môn học (`subject`) là một không gian dữ liệu cô lập hoàn toàn.**
   Giáo viên môn Sinh học và giáo viên môn Lịch sử không bao giờ thấy, đọc, hay
   dùng chung bất kỳ dữ liệu nào của nhau — kể cả khi họ cùng dùng chung 1 app,
   1 Firebase project. Đây **không phải** mô hình "nhiều giáo viên chia sẻ ngân
   hàng câu hỏi trong cùng 1 môn" — mỗi `subjectId` gắn với đúng 1 giáo viên sở
   hữu (`ownerTeacherId`) trong bản V7 này.
2. **Mọi document "theo năm học" đều gắn `schoolYear`** (ví dụ `"2027-2028"`),
   để hỗ trợ quy trình đóng năm học (archive → xoá) mà không đụng tới dữ liệu
   bền vững (ngân hàng câu hỏi, khung chương trình, tài khoản).
3. **Không có fallback phân quyền theo domain email** (bài học từ
   `firestore.rules` của V6.3.8 — đã gây rủi ro bảo mật). Mọi quyền truy cập
   đều tường minh qua `ownerTeacherId` / `createdBy` đối chiếu `request.auth.uid`.

## Cây collection (Firestore, top-level)

```
/platformConfig/{singleton}         # Owner cấu hình chung: thang điểm, thời gian mặc định, theme
/users/{uid}                        # role: "owner" | "teacher"; nếu teacher: subjectIds[] sở hữu
/subjects/{subjectId}                # tên môn, ownerTeacherId, trạng thái, schoolYearCurrent
  /curriculum/{nodeId}               # khung chương trình của môn (bền vững, không theo năm)
  /questionBank/{questionId}         # ngân hàng câu hỏi (bền vững, không theo năm)
  /classes/{classId}                 # lớp — gắn schoolYear
    /students/{studentId}
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

## Quy trình đóng năm học (tham khảo)

Xem `functions/src/yearRollover.ts` — chạy khi Owner kích hoạt, theo đúng 4
bước đã chốt trong kế hoạch kiến trúc: xuất báo cáo → archive read-only X
tháng (mặc định 6, cấu hình ở `platformConfig.archiveRetentionMonths`) → xoá
vĩnh viễn sau khi hết hạn → giữ nguyên dữ liệu bền vững.
