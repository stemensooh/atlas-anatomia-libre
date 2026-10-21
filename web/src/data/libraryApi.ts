import { json, request } from "./api";

// Vistas guardadas, notas por estructura y resultados de cuestionarios (server/src/library.ts).

export interface SavedView {
  id: number;
  name: string;
  state: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface StructureNote {
  structureId: string;
  note: string;
  updatedAt: string;
}

export interface QuizResults {
  quizId: string;
  attemptCount: number;
  studentCount: number;
  avgRatio: number | null;
  students: Array<{
    userId: number;
    username: string;
    attempts: number;
    bestScore: number;
    lastScore: number;
    avgRatio: number;
    total: number;
    lastAt: string;
  }>;
  questions: Array<{
    questionId: string;
    prompt: string;
    targetNameEs: string;
    answered: number;
    correct: number;
    revealed: number;
    topWrong: Array<{ answer: string; count: number }>;
  }>;
  recent: Array<{ id: number; username: string; score: number; total: number; finishedAt: string }>;
}

export const listViews = () => request<SavedView[]>("/api/views");

export const createView = (name: string, state: unknown) =>
  request<SavedView>("/api/views", json("POST", { name, state }));

export const updateView = (id: number, patch: { name?: string; state?: unknown }) =>
  request<SavedView>(`/api/views/${id}`, json("PATCH", patch));

export const deleteView = (id: number) => request<void>(`/api/views/${id}`, json("DELETE"));

export const listNotes = () => request<StructureNote[]>("/api/notes");

// Devuelve la nota guardada, o undefined si se envió vacía (el servidor la borra).
export const saveNote = (structureId: string, note: string) =>
  request<StructureNote | undefined>(
    `/api/notes/${encodeURIComponent(structureId)}`,
    json("PUT", { note })
  );

export const getQuizResults = (quizId: string) =>
  request<QuizResults>(`/api/quizzes/${encodeURIComponent(quizId)}/results`);
