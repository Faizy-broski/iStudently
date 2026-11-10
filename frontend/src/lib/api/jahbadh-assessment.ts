// Jahbadh assessment tools (Wave 6). Mirrors packages/api-client/src/modules/jahbadh-assessment.ts
// (same paths); types are imported type-only (the web does not import packages at runtime). Keep both in step.
import type {
  JcAnswerKey, JcAnswerKeyInput, JcAnswerSheets, JcItemAnalysis, JcSimilarity, JcMastery, JcFairness, JcArchivedTest,
  JgQuizTarget, JgQuizKey, JgQuizKeyInput, JgQuizGrading, JgQuizCommitPreview, JaVersion,
} from "@studently/api-client/modules/jahbadh-assessment";
import { jgRequest, jgOpenPdfPath } from "./jahbadh-grades";

export type * from "@studently/api-client/modules/jahbadh-assessment";

const q = (params: Record<string, string | number | null | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};
const get = <T,>(path: string) => jgRequest<T>(path);
const post = <T,>(path: string, body: unknown) => jgRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
const put = <T,>(path: string, body: unknown) => jgRequest<T>(path, { method: "PUT", body: JSON.stringify(body) });
const del = <T,>(path: string) => jgRequest<T>(path, { method: "DELETE" });

const id = (v: string) => encodeURIComponent(v);
const s = (sessionId: string) => `/jahbadh-control/sessions/${id(sessionId)}`;
const k = (sessionId: string, keyId: string) => `${s(sessionId)}/answer-keys/${id(keyId)}`;
const qg = (sectionId: string) => `/jahbadh-grades/sections/${id(sectionId)}/quiz-grading`;

export const jaApi = {
  keys: (sessionId: string) => get<JcAnswerKey[]>(`${s(sessionId)}/answer-keys`),
  saveKey: (sessionId: string, body: JcAnswerKeyInput) => post<JcAnswerKey>(`${s(sessionId)}/answer-keys`, body),
  deleteKey: (sessionId: string, keyId: string) => del<{ deleted: boolean }>(k(sessionId, keyId)),
  sheets: (sessionId: string, keyId: string) => get<JcAnswerSheets>(`${k(sessionId, keyId)}/sheets`),
  saveSheets: (sessionId: string, keyId: string, entries: { secret: number; answers: string | (string | null)[] | null; version?: JaVersion | null }[]) =>
    put<JcAnswerSheets>(`${k(sessionId, keyId)}/sheets`, { entries }),
  transferPreview: (sessionId: string, keyId: string, entry: 1 | 2 = 1) =>
    get<{ entry: 1 | 2; cells: { secret: number; subject_key: string; score: number | null }[]; count: number }>(`${k(sessionId, keyId)}/transfer${q({ entry })}`),
  transfer: (sessionId: string, keyId: string, entry: 1 | 2 = 1) => post<{ entry: 1 | 2; transferred: number; saved: number; cleared: number }>(`${k(sessionId, keyId)}/transfer`, { entry }),
  analysis: (sessionId: string, keyId: string, version: "A" | "B" | "all" = "all") => get<JcItemAnalysis>(`${k(sessionId, keyId)}/analysis${q({ version })}`),
  similarity: (sessionId: string, keyId: string, pair?: { a: number; b: number } | null) => get<JcSimilarity>(`${k(sessionId, keyId)}/similarity${q({ a: pair?.a, b: pair?.b })}`),
  mastery: (sessionId: string, keyId: string) => get<JcMastery>(`${k(sessionId, keyId)}/mastery`),
  archiveKey: (sessionId: string, keyId: string, body: { name?: string; test_date?: string | null } = {}) => post<{ id: string }>(`${k(sessionId, keyId)}/archive`, body),
  fairness: (sessionId: string, gradeLevelId: string, threshold?: number) => get<JcFairness>(`${s(sessionId)}/fairness${q({ grade_level_id: gradeLevelId, threshold })}`),
  archive: (sessionId: string) => get<JcArchivedTest[]>(`${s(sessionId)}/test-archive`),
  recallArchive: (sessionId: string, archiveId: string, target: { grade_level_id: string; subject_key: string; part_key?: string }) =>
    post<JcAnswerKey>(`${s(sessionId)}/test-archive/${id(archiveId)}/recall`, target),
  deleteArchive: (sessionId: string, archiveId: string) => del<{ deleted: boolean }>(`${s(sessionId)}/test-archive/${id(archiveId)}`),

  quizTargets: (sectionId: string) => get<JgQuizTarget[]>(`${qg(sectionId)}/targets`),
  quizKeys: (sectionId: string) => get<JgQuizKey[]>(qg(sectionId)),
  saveQuizKey: (sectionId: string, body: JgQuizKeyInput) => post<JgQuizGrading>(qg(sectionId), body),
  quizKey: (sectionId: string, quizKeyId: string) => get<JgQuizGrading>(`${qg(sectionId)}/${id(quizKeyId)}`),
  deleteQuizKey: (sectionId: string, quizKeyId: string) => del<{ deleted: boolean }>(`${qg(sectionId)}/${id(quizKeyId)}`),
  saveQuizAnswers: (sectionId: string, quizKeyId: string, entries: { student_id: string; answers: string | (string | null)[] | null }[]) =>
    put<JgQuizGrading>(`${qg(sectionId)}/${id(quizKeyId)}/answers`, { entries }),
  quizCommitPreview: (sectionId: string, quizKeyId: string) => get<JgQuizCommitPreview>(`${qg(sectionId)}/${id(quizKeyId)}/commit`),
  quizCommit: (sectionId: string, quizKeyId: string) => post<{ written: number; target: JgQuizTarget }>(`${qg(sectionId)}/${id(quizKeyId)}/commit`, {}),
  /** The signed-in user's platform quizzes (to take auto-graded scores from). */
  myQuizzes: () => get<{ id: string; title: string }[]>(`/quiz${q({ mine: 1 })}`),
};

export function openErrorSlips(sessionId: string, keyId: string) {
  return jgOpenPdfPath(`${k(sessionId, keyId)}/error-slips.pdf`);
}

export function openBubbleSheets(sessionId: string, keyId: string, opts: { committeeId?: string | null; offset?: number } = {}) {
  return jgOpenPdfPath(`${k(sessionId, keyId)}/bubble-sheets.pdf${q({ committee_id: opts.committeeId ?? undefined, offset: opts.offset || undefined })}`);
}
