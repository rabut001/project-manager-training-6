import { describe, expect, it } from "vitest";
import type { Question } from "./exam.ts";
import {
  clearAnswers,
  confirmAnswer,
  countConfirmed,
  emptyProgress,
  formatScore,
  gradeDrafts,
  loadProgress,
  saveProgress,
  score,
  selectChoice,
  storageKey,
  toggleCheck,
  type StorageLike,
} from "./progress.ts";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const nos = [1, 2, 3, 4, 5];
const question = (no: number, answer: Question["answer"]): Question => ({
  no,
  answer,
  image: `x/q${no}.webp`,
  explanation: "",
});

describe("選択と確認", () => {
  it("確認前は選び直せ、確認後は固定される", () => {
    let progress = emptyProgress(1);
    progress = selectChoice(progress, 1, "ア");
    progress = selectChoice(progress, 1, "イ");
    expect(progress.answers[1]).toEqual({ choice: "イ", confirmed: false });
    progress = confirmAnswer(progress, 1);
    progress = selectChoice(progress, 1, "ウ");
    expect(progress.answers[1]).toEqual({ choice: "イ", confirmed: true });
  });

  it("未選択の問は確認できない", () => {
    const progress = emptyProgress(1);
    expect(confirmAnswer(progress, 1)).toBe(progress);
  });
});

describe("一括採点", () => {
  it("選択済みで未確認の問だけを確認済みにし、チェックは変えない", () => {
    let progress = emptyProgress(1);
    progress = selectChoice(progress, 1, "ア");
    progress = confirmAnswer(progress, 1);
    progress = selectChoice(progress, 2, "イ");
    progress = selectChoice(progress, 3, "ウ");
    progress = toggleCheck(progress, 3);
    const graded = gradeDrafts(progress);
    expect(graded.answers[1]).toEqual({ choice: "ア", confirmed: true });
    expect(graded.answers[2]).toEqual({ choice: "イ", confirmed: true });
    expect(graded.answers[3]).toEqual({ choice: "ウ", confirmed: true });
    expect(graded.answers[4]).toBeUndefined();
    expect(graded.checked).toEqual([3]);
  });
});

describe("クリア", () => {
  it("解答と開いている問を消し、チェックは残す", () => {
    let progress = emptyProgress(1);
    progress = selectChoice(progress, 4, "エ");
    progress = confirmAnswer(progress, 4);
    progress = toggleCheck(progress, 2);
    expect(clearAnswers(progress, 1)).toEqual({ currentNo: 1, answers: {}, checked: [2] });
  });
});

describe("チェック", () => {
  it("付け外しでき、選択と正誤は変わらない", () => {
    let progress = selectChoice(emptyProgress(1), 2, "イ");
    progress = confirmAnswer(progress, 2);
    const checked = toggleCheck(progress, 2);
    expect(checked.checked).toEqual([2]);
    expect(checked.answers).toEqual(progress.answers);
    expect(toggleCheck(checked, 2).checked).toEqual([]);
  });
});

describe("保存と復元", () => {
  it("保存した進捗を、そのまま復元する", () => {
    const storage = memoryStorage();
    let progress = emptyProgress(1);
    progress = selectChoice(progress, 3, "ウ");
    progress = confirmAnswer(progress, 3);
    progress = selectChoice(progress, 4, "ア");
    progress = toggleCheck(progress, 5);
    saveProgress("e1", progress, storage);
    expect(loadProgress("e1", nos, storage)).toEqual(progress);
    expect(storage.data[storageKey("e1")]).toBeDefined();
  });

  it("保存がなければ先頭の問から始める", () => {
    expect(loadProgress("e1", [2, 3], memoryStorage())).toEqual({ currentNo: 2, answers: {}, checked: [] });
  });

  it("読めない項目だけを捨てる", () => {
    const storage = memoryStorage({
      [storageKey("e1")]: JSON.stringify({
        currentNo: 99,
        answers: {
          "1": { choice: "ア", confirmed: true },
          "2": { choice: "オ", confirmed: true },
          "9": { choice: "イ", confirmed: false },
        },
        checked: [2, 2, "x", 42, 1],
      }),
    });
    expect(loadProgress("e1", nos, storage)).toEqual({
      currentNo: 1,
      answers: { 1: { choice: "ア", confirmed: true } },
      checked: [1, 2],
    });
  });

  it("壊れた値や保存できない環境でも動く", () => {
    expect(loadProgress("e1", nos, memoryStorage({ [storageKey("e1")]: "{" })).currentNo).toBe(1);
    expect(loadProgress("e1", nos, null).currentNo).toBe(1);
    const failing: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadProgress("e1", nos, failing).currentNo).toBe(1);
    expect(() => saveProgress("e1", emptyProgress(1), failing)).not.toThrow();
    expect(countConfirmed("e1", failing)).toBe(0);
  });

  it("回ごとに保存を分ける", () => {
    const storage = memoryStorage();
    saveProgress("e1", selectChoice(emptyProgress(1), 1, "ア"), storage);
    expect(loadProgress("e2", nos, storage).answers).toEqual({});
  });
});

describe("一覧の確認済みの数", () => {
  it("確認済みの問だけを数える", () => {
    const storage = memoryStorage();
    let progress = selectChoice(emptyProgress(1), 1, "ア");
    progress = confirmAnswer(progress, 1);
    progress = selectChoice(progress, 2, "イ");
    saveProgress("e1", progress, storage);
    expect(countConfirmed("e1", storage)).toBe(1);
    expect(countConfirmed("e2", storage)).toBe(0);
  });
});

describe("正解率", () => {
  const questions = [question(1, "ア"), question(2, "イ"), question(3, "ウ")];

  it("確認していないときは「—」", () => {
    expect(formatScore(score(emptyProgress(1), questions))).toBe("—");
  });

  it("確認済みの問だけを分母にする", () => {
    let progress = emptyProgress(1);
    progress = confirmAnswer(selectChoice(progress, 1, "ア"), 1);
    progress = confirmAnswer(selectChoice(progress, 2, "ア"), 2);
    progress = selectChoice(progress, 3, "ウ");
    expect(formatScore(score(progress, questions))).toBe("1/2（50%）");
  });
});
