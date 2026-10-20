import { useEffect, useState } from "react";
import { ExamList, MissingExam } from "./ExamList.tsx";
import { loadExam, loadIndex, type Exam, type ExamSummary } from "./exam.ts";
import { Practice } from "./Practice.tsx";
import { routeFromHash, useHash } from "./route.ts";

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : "読み込みに失敗しました。";
}

function ExamScreen({ examId }: { examId: string }) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadExam(examId)
      .then((loaded) => active && setExam(loaded))
      .catch((reason: unknown) => active && setError(message(reason)));
    return () => {
      active = false;
    };
  }, [examId]);

  if (error) {
    return <p className="status">{error}</p>;
  }
  if (!exam) {
    return <p className="status">問題を読み込んでいます。</p>;
  }
  return <Practice exam={exam} />;
}

export function App() {
  const route = routeFromHash(useHash());
  const [index, setIndex] = useState<ExamSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadIndex()
      .then((loaded) => active && setIndex(loaded))
      .catch((reason: unknown) => active && setError(message(reason)));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <p className="status">{error}</p>;
  }
  if (!index) {
    return <p className="status">回を読み込んでいます。</p>;
  }
  if (route.name === "list") {
    return <ExamList exams={index} />;
  }
  if (route.name === "exam" && index.some((item) => item.id === route.id)) {
    return <ExamScreen key={route.id} examId={route.id} />;
  }
  return <MissingExam />;
}
