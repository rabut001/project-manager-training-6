export const CHOICES = ["ア", "イ", "ウ", "エ"] as const;

export type Choice = (typeof CHOICES)[number];

export type Question = {
  no: number;
  answer: Choice;
  image: string;
  explanation: string;
};

export type Excluded = {
  no: number;
  reason: string;
};

export type Exam = {
  id: string;
  title: string;
  excluded: Excluded[];
  questions: Question[];
};

export type ExamSummary = {
  id: string;
  title: string;
  count: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isChoice(value: unknown): value is Choice {
  return typeof value === "string" && (CHOICES as readonly string[]).includes(value);
}

function isQuestion(value: unknown): value is Question {
  return (
    isRecord(value) &&
    typeof value.no === "number" &&
    isChoice(value.answer) &&
    typeof value.image === "string" &&
    typeof value.explanation === "string"
  );
}

function isExcluded(value: unknown): value is Excluded {
  return isRecord(value) && typeof value.no === "number" && typeof value.reason === "string";
}

export function parseExam(value: unknown): Exam {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !Array.isArray(value.questions) ||
    value.questions.length === 0 ||
    !value.questions.every(isQuestion)
  ) {
    throw new Error("問題データの形式が不正です。");
  }
  const excluded = value.excluded === undefined ? [] : value.excluded;
  if (!Array.isArray(excluded) || !excluded.every(isExcluded)) {
    throw new Error("問題データの形式が不正です。");
  }
  return { id: value.id, title: value.title, excluded, questions: value.questions };
}

export function parseIndex(value: unknown): ExamSummary[] {
  if (!Array.isArray(value)) {
    throw new Error("回の一覧の形式が不正です。");
  }
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.count !== "number"
    ) {
      throw new Error("回の一覧の形式が不正です。");
    }
    return { id: item.id, title: item.title, count: item.count };
  });
}

// content/ は publicDir なので、サイトのルートからの相対パスで読める。
export function contentUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function fetchJson(path: string, failure: string): Promise<unknown> {
  const response = await fetch(contentUrl(path));
  if (!response.ok) {
    throw new Error(failure);
  }
  return response.json();
}

let indexCache: Promise<ExamSummary[]> | undefined;
const examCache = new Map<string, Promise<Exam>>();

export function loadIndex(): Promise<ExamSummary[]> {
  indexCache ??= fetchJson("exams.json", "回の一覧を読み込めませんでした。")
    .then(parseIndex)
    .catch((error: unknown) => {
      indexCache = undefined;
      throw error;
    });
  return indexCache;
}

export function loadExam(id: string): Promise<Exam> {
  let pending = examCache.get(id);
  if (!pending) {
    pending = fetchJson(`${id}.json`, "問題データを読み込めませんでした。")
      .then((value) => {
        const exam = parseExam(value);
        if (exam.id !== id) {
          throw new Error("問題データの id が一致しません。");
        }
        return exam;
      })
      .catch((error: unknown) => {
        examCache.delete(id);
        throw error;
      });
    examCache.set(id, pending);
  }
  return pending;
}
