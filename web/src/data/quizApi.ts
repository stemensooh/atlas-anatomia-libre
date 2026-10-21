import { AnatomyQuiz, ANATOMY_QUIZZES } from "./didacticData";
import { json, request } from "./api";
import { SystemId } from "./types";
import { BodySex } from "../store/useViewerStore";

// Cliente de la API de cuestionarios (server/). Vite reenvía /api al puerto 3001 en desarrollo.

export interface QuizAnswer {
  questionId: string;
  correct: boolean;
  answer: string | null;
  revealed: boolean;
}

export interface QuizAttempt {
  id: number;
  quizId: string;
  quizTitle?: string;
  score: number;
  total: number;
  answers: QuizAnswer[];
  finishedAt: string;
}

export interface GenerateQuizInput {
  bodySex: BodySex;
  systems: SystemId[];
  count: number;
  mode: "mixed" | "find3d" | "multipleChoice";
  difficulty: "basico" | "intermedio" | "avanzado";
  title?: string;
}

export type QuizInput = Pick<AnatomyQuiz, "title" | "subtitle" | "questions">;

export { ApiError } from "./api";

// Carga los cuestionarios de la BD; si el servidor no responde, usa los incluidos en la web.
export async function loadQuizzes(): Promise<{ quizzes: AnatomyQuiz[]; online: boolean }> {
  try {
    const quizzes = await request<AnatomyQuiz[]>("/api/quizzes");
    return { quizzes, online: true };
  } catch {
    return { quizzes: ANATOMY_QUIZZES, online: false };
  }
}

export const createQuiz = (quiz: QuizInput) =>
  request<AnatomyQuiz>("/api/quizzes", { method: "POST", body: JSON.stringify(quiz) });

export const updateQuiz = (id: string, quiz: QuizInput) =>
  request<AnatomyQuiz>(`/api/quizzes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(quiz),
  });

export const setQuizVisibility = (id: string, isPublic: boolean) =>
  request<AnatomyQuiz>(`/api/quizzes/${encodeURIComponent(id)}/visibility`, json("PATCH", { isPublic }));

export const deleteQuiz = (id: string) =>
  request<void>(`/api/quizzes/${encodeURIComponent(id)}`, { method: "DELETE" });

export const generateQuiz = (input: GenerateQuizInput) =>
  request<AnatomyQuiz>("/api/quizzes/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const listAttempts = (quizId: string) =>
  request<QuizAttempt[]>(`/api/quizzes/${encodeURIComponent(quizId)}/attempts`);

export const saveAttempt = (
  quizId: string,
  attempt: { score: number; total: number; answers: QuizAnswer[] }
) =>
  request<QuizAttempt>(`/api/quizzes/${encodeURIComponent(quizId)}/attempts`, {
    method: "POST",
    body: JSON.stringify(attempt),
  });
