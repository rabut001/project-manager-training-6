import { isChoice, type Choice, type Question } from "./exam.ts";

export type AnswerRecord = {
  choice: Choice;
  confirmed: boolean;
};

export type Progress = {
  currentNo: number;
  answers: Record<number, AnswerRecord>;
  checked: number[];
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function storageKey(examId: string): string {
  return `pm-am2:${examId}`;
}

export function emptyProgress(firstNo: number): Progress {
  return { currentNo: firstNo, answers: {}, checked: [] };
}

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sortedUnique(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStored(raw: string | null): Record<string, unknown> | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// 保存された値のうち、読めない項目だけを捨てる。
export function loadProgress(
  examId: string,
  questionNos: readonly number[],
  storage: StorageLike | null = defaultStorage(),
): Progress {
  const empty = emptyProgress(questionNos[0]);
  let raw: string | null = null;
  try {
    raw = storage?.getItem(storageKey(examId)) ?? null;
  } catch {
    return empty;
  }
  const stored = parseStored(raw);
  if (!stored) {
    return empty;
  }
  const known = new Set(questionNos);
  const answers: Record<number, AnswerRecord> = {};
  if (isRecord(stored.answers)) {
    for (const [key, value] of Object.entries(stored.answers)) {
      const no = Number(key);
      if (
        known.has(no) &&
        isRecord(value) &&
        isChoice(value.choice) &&
        typeof value.confirmed === "boolean"
      ) {
        answers[no] = { choice: value.choice, confirmed: value.confirmed };
      }
    }
  }
  const checked = Array.isArray(stored.checked)
    ? sortedUnique(
        stored.checked.filter((no): no is number => typeof no === "number" && known.has(no)),
      )
    : [];
  const currentNo =
    typeof stored.currentNo === "number" && known.has(stored.currentNo)
      ? stored.currentNo
      : empty.currentNo;
  return { currentNo, answers, checked };
}

export function saveProgress(
  examId: string,
  progress: Progress,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.setItem(storageKey(examId), JSON.stringify(progress));
  } catch {
    // 保存できなくても、画面は動かし続ける。
  }
}

// 一覧に出す、確認済みの問の数。
export function countConfirmed(
  examId: string,
  storage: StorageLike | null = defaultStorage(),
): number {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(storageKey(examId)) ?? null;
  } catch {
    return 0;
  }
  const stored = parseStored(raw);
  if (!stored || !isRecord(stored.answers)) {
    return 0;
  }
  return Object.values(stored.answers).filter(
    (value) => isRecord(value) && isChoice(value.choice) && value.confirmed === true,
  ).length;
}

export function selectChoice(progress: Progress, no: number, choice: Choice): Progress {
  if (progress.answers[no]?.confirmed) {
    return progress;
  }
  return {
    ...progress,
    currentNo: no,
    answers: { ...progress.answers, [no]: { choice, confirmed: false } },
  };
}

export function confirmAnswer(progress: Progress, no: number): Progress {
  const record = progress.answers[no];
  if (!record || record.confirmed) {
    return progress;
  }
  return {
    ...progress,
    answers: { ...progress.answers, [no]: { choice: record.choice, confirmed: true } },
  };
}

export function draftNos(progress: Progress): number[] {
  return Object.entries(progress.answers)
    .filter(([, record]) => !record.confirmed)
    .map(([no]) => Number(no));
}

export function gradeDrafts(progress: Progress): Progress {
  const answers = { ...progress.answers };
  for (const no of draftNos(progress)) {
    answers[no] = { choice: answers[no].choice, confirmed: true };
  }
  return { ...progress, answers };
}

export function toggleCheck(progress: Progress, no: number): Progress {
  const checked = progress.checked.includes(no)
    ? progress.checked.filter((item) => item !== no)
    : sortedUnique([...progress.checked, no]);
  return { ...progress, checked };
}

// 解答と開いている問を消す。チェックは残す。
export function clearAnswers(progress: Progress, firstNo: number): Progress {
  return { currentNo: firstNo, answers: {}, checked: progress.checked };
}

export type Score = { confirmed: number; correct: number };

export function score(progress: Progress, questions: readonly Question[]): Score {
  let confirmed = 0;
  let correct = 0;
  for (const question of questions) {
    const record = progress.answers[question.no];
    if (record?.confirmed) {
      confirmed += 1;
      if (record.choice === question.answer) {
        correct += 1;
      }
    }
  }
  return { confirmed, correct };
}

export function formatScore({ confirmed, correct }: Score): string {
  if (confirmed === 0) {
    return "—";
  }
  return `${correct}/${confirmed}（${Math.round((correct / confirmed) * 100)}%）`;
}
