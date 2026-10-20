import { useEffect, useRef, useState } from "react";
import { CHOICES, contentUrl, type Choice, type Exam, type Question } from "./exam.ts";
import {
  clearAnswers,
  confirmAnswer,
  draftNos,
  formatScore,
  gradeDrafts,
  loadProgress,
  saveProgress,
  score,
  selectChoice,
  toggleCheck,
  type AnswerRecord,
  type Progress,
} from "./progress.ts";
import { LIST_HREF } from "./route.ts";

const IPA_URL = "https://www.ipa.go.jp/shiken/mondai-kaiotu/index.html";

type DialogKind = "clear" | "grade";

function statusLabel(answer: AnswerRecord | undefined, question: Question): string {
  if (!answer) {
    return "未選択";
  }
  if (!answer.confirmed) {
    return "選択済み、未確認";
  }
  return answer.choice === question.answer ? "正解" : "誤答";
}

function numberLabel(question: Question, answer: AnswerRecord | undefined, checked: boolean): string {
  return `問${question.no}、${checked ? "チェック済み、" : ""}${statusLabel(answer, question)}`;
}

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);
  return ref;
}

export function Practice({ exam }: { exam: Exam }) {
  const nos = exam.questions.map((item) => item.no);
  const firstNo = nos[0];
  const [progress, setProgress] = useState<Progress>(() => loadProgress(exam.id, nos));
  const [dialogKind, setDialogKind] = useState<DialogKind | null>(null);
  const [lastKind, setLastKind] = useState<DialogKind>("clear");
  const [viewerOpen, setViewerOpen] = useState(false);
  const confirmDialog = useDialog(dialogKind !== null);
  const viewerDialog = useDialog(viewerOpen);
  const imageScroll = useRef<HTMLDivElement>(null);
  const lower = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLElement>(null);

  const index = Math.max(0, nos.indexOf(progress.currentNo));
  const question = exam.questions[index];
  const answer = progress.answers[question.no];
  const confirmed = answer?.confirmed ?? false;
  const checked = progress.checked.includes(question.no);
  const drafts = draftNos(progress).length;

  useEffect(() => {
    saveProgress(exam.id, progress);
  }, [exam.id, progress]);

  // 別の問へ移ったら、スクロールを先頭に戻し、番号の列では今の問が見える位置に寄せる。
  useEffect(() => {
    imageScroll.current?.scrollTo(0, 0);
    lower.current?.scrollTo(0, 0);
    const list = strip.current;
    const current = list?.querySelector<HTMLElement>("[aria-current='true']");
    if (list && current) {
      list.scrollLeft = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
    }
  }, [question.no]);

  function select(choice: Choice) {
    setProgress((current) => selectChoice(current, question.no, choice));
  }

  function confirm() {
    setProgress((current) => confirmAnswer(current, question.no));
  }

  function moveTo(targetIndex: number) {
    const target = nos[targetIndex];
    if (target !== undefined) {
      setProgress((current) => ({ ...current, currentNo: target }));
    }
  }

  function openDialog(kind: DialogKind) {
    setLastKind(kind);
    setDialogKind(kind);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (dialogKind || viewerOpen || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      const onControl = target?.closest("button, a, input, textarea, select") !== null;
      const choice = CHOICES[Number(event.key) - 1];
      if (choice) {
        select(choice);
      } else if (event.key === "Enter" && !onControl) {
        confirm();
      } else if (event.key === "ArrowLeft") {
        moveTo(index - 1);
      } else if (event.key === "ArrowRight") {
        moveTo(index + 1);
      } else {
        return;
      }
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const shown = dialogKind ?? lastKind;

  return (
    <div className="practice">
      <header className="top">
        <div className="tools">
          <a className="back" href={LIST_HREF}>
            一覧へ戻る
          </a>
          <button type="button" disabled={drafts === 0} onClick={() => openDialog("grade")}>
            一括採点
          </button>
          <button type="button" aria-label="回答をすべてクリア" onClick={() => openDialog("clear")}>
            クリア
          </button>
        </div>
        <div className="heading">
          <h1>{exam.title}</h1>
          <p className="score">
            正解 <span>{formatScore(score(progress, exam.questions))}</span>
          </p>
        </div>
        <nav className="numbers" aria-label="問題番号" ref={strip}>
          {exam.questions.map((item) => {
            const record = progress.answers[item.no];
            const isChecked = progress.checked.includes(item.no);
            const classes = ["number"];
            if (item.no === question.no) {
              classes.push("current");
            }
            if (record?.confirmed) {
              classes.push(record.choice === item.answer ? "correct" : "incorrect");
            } else if (record) {
              classes.push("draft");
            }
            return (
              <button
                key={item.no}
                type="button"
                className={classes.join(" ")}
                aria-current={item.no === question.no ? "true" : undefined}
                aria-label={numberLabel(item, record, isChecked)}
                onClick={() => moveTo(nos.indexOf(item.no))}
              >
                <span>{item.no}</span>
                <span className="badges" aria-hidden="true">
                  {record?.confirmed && (
                    <span className="mark">{record.choice === item.answer ? "○" : "×"}</span>
                  )}
                  {isChecked && (
                    <span className="flag">
                      <svg viewBox="0 0 16 16">
                        <path d="M2.6 8.2 6.4 12.2 13.4 3.8" />
                      </svg>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="image-pane">
        <div className="image-head">
          <span className="hint">問{question.no}　画像を押すと拡大</span>
          <label className="check">
            <input
              type="checkbox"
              checked={checked}
              aria-label={`問${question.no}をチェック`}
              onChange={() => setProgress((current) => toggleCheck(current, question.no))}
            />
          </label>
        </div>
        <div className="image-scroll" ref={imageScroll}>
          <button
            type="button"
            className="image-button"
            aria-label={`問${question.no}の画像を拡大`}
            onClick={() => setViewerOpen(true)}
          >
            <img src={contentUrl(question.image)} alt={`問${question.no}`} />
          </button>
        </div>
      </div>

      <div className="lower" ref={lower}>
        {confirmed && answer && (
          <section className="result" aria-live="polite">
            <p className={answer.choice === question.answer ? "ok" : "ng"}>
              {answer.choice === question.answer ? "正解" : "不正解"}
            </p>
            <p>
              正答 <strong>{question.answer}</strong>
            </p>
            <p className="explanation">{question.explanation}</p>
            <p className="note">
              IPA の公式解説ではない。AI が作成した解説で、誤りを含む可能性がある。
            </p>
          </section>
        )}
        <footer>
          {exam.excluded.map((item) => (
            <p key={item.no}>{item.reason}</p>
          ))}
          <p>
            出典: <a href={IPA_URL}>IPA の過去問題</a>
          </p>
        </footer>
      </div>

      <div className="dock">
        <div className="choices" role="group" aria-label="選択肢">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={answer?.choice === choice ? "selected" : undefined}
              aria-pressed={answer?.choice === choice}
              disabled={confirmed}
              onClick={() => select(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" disabled={index === 0} onClick={() => moveTo(index - 1)}>
            前へ
          </button>
          <button type="button" className="confirm" disabled={!answer || confirmed} onClick={confirm}>
            {confirmed ? "確認済み" : "結果を確認"}
          </button>
          <button
            type="button"
            disabled={index === nos.length - 1}
            onClick={() => moveTo(index + 1)}
          >
            次へ
          </button>
        </div>
      </div>

      <dialog
        ref={confirmDialog}
        onClose={() => setDialogKind(null)}
        aria-labelledby="dialog-title"
      >
        {shown === "grade" ? (
          <>
            <h2 id="dialog-title">選択済みの問をまとめて採点します</h2>
            <p>
              選択済みで未確認の{drafts}
              問を確認済みにします。採点後は、その問の選択を変えられません。未選択の問は採点しません。
            </p>
          </>
        ) : (
          <>
            <h2 id="dialog-title">この回の解答を消します</h2>
            <p>
              {exam.title}
              の確認済みの解答と、まだ確認していない選択を消して、最初の問に戻ります。チェックはそのまま残します。
            </p>
          </>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={() => setDialogKind(null)}>
            中止
          </button>
          {shown === "grade" ? (
            <button
              type="button"
              onClick={() => {
                setProgress(gradeDrafts);
                setDialogKind(null);
              }}
            >
              採点する
            </button>
          ) : (
            <button
              type="button"
              className="danger"
              onClick={() => {
                setProgress((current) => clearAnswers(current, firstNo));
                setDialogKind(null);
              }}
            >
              消してやり直す
            </button>
          )}
        </div>
      </dialog>

      <dialog
        ref={viewerDialog}
        className="viewer"
        onClose={() => setViewerOpen(false)}
        aria-label={`問${question.no}の画像`}
      >
        <button type="button" className="viewer-close" onClick={() => setViewerOpen(false)}>
          閉じる
        </button>
        <div className="viewer-scroll">
          {viewerOpen && <img src={contentUrl(question.image)} alt={`問${question.no}`} />}
        </div>
      </dialog>
    </div>
  );
}
