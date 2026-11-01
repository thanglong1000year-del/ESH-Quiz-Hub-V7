/**
 * Phân tích text dán từ Excel/Sheets hoặc gõ tay cho 3 cổng nhập liệu hàng
 * loạt: ngân hàng câu hỏi, danh sách học sinh, danh sách email phụ huynh.
 * Tách riêng khỏi UI để dễ viết test và tái dùng ở nhiều trang.
 */

function splitColumns(line: string): string[] {
  const sep = line.includes("\t") ? "\t" : ",";
  return line.split(sep).map((c) => c.trim());
}

function dataLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Ngân hàng câu hỏi — mỗi dòng: Câu hỏi | Lựa chọn A | B | C | D | Đáp án đúng | Tags
// Dòng đầu tiên là tiêu đề cột (header) — bị bỏ qua, chỉ dùng để tự nhận diện.
// Đáp án đúng ghi theo chữ cái (A, B, C, D), nhiều đáp án cách nhau bằng dấu phẩy.
// ---------------------------------------------------------------------------

export interface ParsedBulkQuestion {
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  tags: string[];
}

export interface BulkImportResult<T> {
  items: T[];
  errors: string[]; // "Dòng 3: ..."
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function parseQuestionBankBulkText(text: string): BulkImportResult<ParsedBulkQuestion> {
  const lines = dataLines(text);
  const items: ParsedBulkQuestion[] = [];
  const errors: string[] = [];
  if (lines.length === 0) return { items, errors };

  const first = splitColumns(lines[0]).join(" ").toLowerCase();
  const hasHeader = /câu hỏi|cau hoi|lựa chọn|lua chon|đáp án|dap an/.test(first);
  const start = hasHeader ? 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const rowNum = i + 1;
    const cols = splitColumns(lines[i]);
    const prompt = cols[0] || "";
    if (!prompt) {
      errors.push(`Dòng ${rowNum}: thiếu nội dung câu hỏi.`);
      continue;
    }
    // Cột 1..(n-2) là lựa chọn, cột áp chót là đáp án đúng, cột cuối (nếu có) là tags.
    // Đoán vị trí: nếu có >= 4 cột sau prompt thì cột [1..length-2] là lựa chọn,
    // cột [length-1] trở đi có thể là đáp án + tags — nhưng để đơn giản và chắc
    // chắn cho giáo viên, ta cố định cấu trúc: prompt, A, B, C, D, đáp_án, tags?
    const optionTexts = [cols[1], cols[2], cols[3], cols[4]].filter((v) => v && v.trim());
    const answerCell = (cols[5] || "").trim();
    const tagsCell = (cols[6] || "").trim();

    if (optionTexts.length < 2) {
      errors.push(`Dòng ${rowNum}: cần ít nhất 2 lựa chọn (cột B, C).`);
      continue;
    }
    if (!answerCell) {
      errors.push(`Dòng ${rowNum}: thiếu cột đáp án đúng (vd: "B" hoặc "A,C").`);
      continue;
    }

    const options = optionTexts.map((text, idx) => ({ id: `opt_${rowNum}_${idx}`, text }));
    const answerLetters = answerCell
      .split(/[,;]/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const correctOptionIds: string[] = [];
    let badLetter = false;
    for (const letter of answerLetters) {
      const idx = LETTERS.indexOf(letter);
      if (idx < 0 || idx >= options.length) {
        badLetter = true;
        break;
      }
      correctOptionIds.push(options[idx].id);
    }
    if (badLetter || correctOptionIds.length === 0) {
      errors.push(
        `Dòng ${rowNum}: đáp án đúng "${answerCell}" không khớp với các lựa chọn đã nhập (chỉ dùng A..${LETTERS[optionTexts.length - 1]}).`
      );
      continue;
    }

    const tags = tagsCell
      ? tagsCell.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
      : [];

    items.push({ prompt, options, correctOptionIds, tags });
  }

  return { items, errors };
}

// ---------------------------------------------------------------------------
// Danh sách học sinh — mỗi dòng: Tên [, Email học sinh [, Email phụ huynh]]
// Tương thích ngược: chỉ gõ tên (không dấu phẩy) vẫn hoạt động như trước.
// ---------------------------------------------------------------------------

export interface ParsedBulkStudent {
  fullName: string;
  studentEmail?: string;
  parentEmail?: string;
}

export function parseStudentRosterBulkText(text: string): BulkImportResult<ParsedBulkStudent> {
  const lines = dataLines(text);
  const items: ParsedBulkStudent[] = [];
  const errors: string[] = [];

  lines.forEach((line, i) => {
    const rowNum = i + 1;
    const cols = splitColumns(line);
    const fullName = (cols[0] || "").trim();
    if (!fullName) {
      errors.push(`Dòng ${rowNum}: thiếu tên học sinh.`);
      return;
    }
    const studentEmail = (cols[1] || "").trim();
    const parentEmail = (cols[2] || "").trim();
    if (studentEmail && !studentEmail.includes("@")) {
      errors.push(`Dòng ${rowNum}: email học sinh "${studentEmail}" không hợp lệ.`);
      return;
    }
    if (parentEmail && !parentEmail.includes("@")) {
      errors.push(`Dòng ${rowNum}: email phụ huynh "${parentEmail}" không hợp lệ.`);
      return;
    }
    items.push({
      fullName,
      studentEmail: studentEmail || undefined,
      parentEmail: parentEmail || undefined,
    });
  });

  return { items, errors };
}

// ---------------------------------------------------------------------------
// Cập nhật email phụ huynh hàng loạt — mỗi dòng: Tên học sinh, Email phụ huynh
// Khớp theo tên (không phân biệt hoa/thường, bỏ khoảng trắng thừa) với học
// sinh ĐÃ CÓ trong lớp — dùng khi nhận được danh sách liên hệ phụ huynh sau.
// ---------------------------------------------------------------------------

export interface ParsedParentContact {
  studentName: string;
  parentEmail: string;
}

export function parseParentContactBulkText(text: string): BulkImportResult<ParsedParentContact> {
  const lines = dataLines(text);
  const items: ParsedParentContact[] = [];
  const errors: string[] = [];

  const first = splitColumns(lines[0] ?? "").join(" ").toLowerCase();
  const hasHeader = /tên|ten|học sinh|hoc sinh|email/.test(first) && !first.includes("@");
  const start = hasHeader ? 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const rowNum = i + 1;
    const cols = splitColumns(lines[i]);
    const studentName = (cols[0] || "").trim();
    const parentEmail = (cols[1] || "").trim();
    if (!studentName || !parentEmail) {
      errors.push(`Dòng ${rowNum}: cần đủ 2 cột — tên học sinh và email phụ huynh.`);
      continue;
    }
    if (!parentEmail.includes("@")) {
      errors.push(`Dòng ${rowNum}: email "${parentEmail}" không hợp lệ.`);
      continue;
    }
    items.push({ studentName, parentEmail });
  }

  return { items, errors };
}

export function normalizeNameForMatch(name: string): string {
  return name.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");
}
