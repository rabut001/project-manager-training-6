import type { ExamSummary } from "./exam.ts";
import { countConfirmed } from "./progress.ts";
import { examHref, LIST_HREF } from "./route.ts";

const IPA_URL = "https://www.ipa.go.jp/shiken/mondai-kaiotu/index.html";

export function ExamList({ exams }: { exams: ExamSummary[] }) {
  return (
    <div className="sheet">
      <h1>プロジェクトマネージャ 午前Ⅱ</h1>
      <nav aria-label="試験の回">
        <ul className="exam-list">
          {exams.map((exam) => {
            const confirmed = countConfirmed(exam.id);
            return (
              <li key={exam.id}>
                <a href={examHref(exam.id)}>
                  <span>{exam.title}</span>
                  {confirmed > 0 && (
                    <span className="count">
                      {confirmed}/{exam.count}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <footer>
        出典: <a href={IPA_URL}>IPA の過去問題</a>
      </footer>
    </div>
  );
}

export function MissingExam() {
  return (
    <div className="sheet">
      <p>この回はありません。</p>
      <a className="back" href={LIST_HREF}>
        一覧へ戻る
      </a>
    </div>
  );
}
