import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase/client";
import type {
  EssayQuestion,
  MultipleChoiceQuestion,
  Question,
} from "@shared/types/core";
import type { ParsedBulkQuestion } from "./bulk-import";

function questionBankRef(subjectId: string) {
  return collection(db, "subjects", subjectId, "questionBank");
}

/** Lắng nghe realtime danh sách câu hỏi còn hoạt động (chưa vào thùng rác). */
export function subscribeQuestions(
  subjectId: string,
  onChange: (questions: Question[]) => void
): Unsubscribe {
  const q = query(
    questionBankRef(subjectId),
    where("deletedAt", "==", null),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question));
  });
}

export function subscribeTrashedQuestions(
  subjectId: string,
  onChange: (questions: Question[]) => void
): Unsubscribe {
  const q = query(
    questionBankRef(subjectId),
    where("deletedAt", "!=", null)
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question));
  });
}

type NewMultipleChoice = Pick<
  MultipleChoiceQuestion,
  "prompt" | "tags" | "options" | "correctOptionIds"
>;
type NewEssay = Pick<EssayQuestion, "prompt" | "tags" | "rubric">;

export async function createMultipleChoiceQuestion(
  subjectId: string,
  createdBy: string,
  input: NewMultipleChoice
) {
  const now = new Date().toISOString();
  await addDoc(questionBankRef(subjectId), {
    subjectId,
    createdBy,
    type: "multiple_choice",
    prompt: input.prompt,
    tags: input.tags,
    options: input.options,
    correctOptionIds: input.correctOptionIds,
    validation: { status: "pending", issues: [] },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

/**
 * Nhập hàng loạt câu hỏi trắc nghiệm đã qua `parseQuestionBankBulkText`.
 * Dùng `writeBatch` (tối đa 450 thao tác/batch, giới hạn Firestore là 500)
 * để tạo nhanh hàng chục/trăm câu cùng lúc thay vì gọi addDoc tuần tự.
 */
export async function createMultipleChoiceQuestionsBulk(
  subjectId: string,
  createdBy: string,
  items: ParsedBulkQuestion[]
): Promise<number> {
  const now = new Date().toISOString();
  const ref = questionBankRef(subjectId);
  let created = 0;
  for (let i = 0; i < items.length; i += 450) {
    const chunk = items.slice(i, i + 450);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const docRef = doc(ref);
      batch.set(docRef, {
        subjectId,
        createdBy,
        type: "multiple_choice",
        prompt: item.prompt,
        tags: item.tags,
        options: item.options,
        correctOptionIds: item.correctOptionIds,
        validation: { status: "pending", issues: [] },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
    await batch.commit();
    created += chunk.length;
  }
  return created;
}

export async function createEssayQuestion(
  subjectId: string,
  createdBy: string,
  input: NewEssay
) {
  const now = new Date().toISOString();
  await addDoc(questionBankRef(subjectId), {
    subjectId,
    createdBy,
    type: "essay",
    prompt: input.prompt,
    tags: input.tags,
    rubric: input.rubric ?? "",
    validation: { status: "pending", issues: [] },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

export async function updateQuestion(
  subjectId: string,
  questionId: string,
  patch: Partial<Question>
) {
  await updateDoc(doc(db, "subjects", subjectId, "questionBank", questionId), {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function softDeleteQuestion(subjectId: string, questionId: string) {
  await updateDoc(doc(db, "subjects", subjectId, "questionBank", questionId), {
    deletedAt: new Date().toISOString(),
  });
}

export async function restoreQuestion(subjectId: string, questionId: string) {
  await updateDoc(doc(db, "subjects", subjectId, "questionBank", questionId), {
    deletedAt: null,
  });
}

/** Xoá field validation để buộc Cloud Function chạy kiểm tra lại (dùng khi debug). */
export async function revalidateQuestion(subjectId: string, questionId: string) {
  await updateDoc(doc(db, "subjects", subjectId, "questionBank", questionId), {
    validation: deleteField(),
    updatedAt: new Date().toISOString(),
  });
}

export { serverTimestamp };
