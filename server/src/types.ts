// Tipos compartidos con la web (web/src/data/didacticData.ts). Mantener sincronizados.

export const SYSTEM_IDS = [
  "skeletal",
  "muscular",
  "circulatory",
  "nervous",
  "digestive",
  "respiratory",
  "urinary",
  "reproductive",
  "lymphatic",
  "integumentary",
] as const;

export type SystemId = (typeof SYSTEM_IDS)[number];
export type BodySex = "male" | "female";
export type QuizSource = "seed" | "manual" | "generated";

export interface QuizQuestion {
  id: string;
  type: "find3d" | "multipleChoice";
  prompt: string;
  hint: string;
  bodySex: BodySex;
  enabledSystems: SystemId[];
  targetStructureId: string;
  targetNameEs: string;
  options?: string[];
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  subtitle: string;
  source: QuizSource;
  createdAt: string;
  updatedAt: string;
  questions: QuizQuestion[];
}

export interface QuizSummary {
  id: string;
  title: string;
  subtitle: string;
  source: QuizSource;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  attemptCount: number;
  bestRatio: number | null;
}

export interface QuizInput {
  id?: string;
  title: string;
  subtitle?: string;
  questions: QuizQuestion[];
}

export interface QuizAnswer {
  questionId: string;
  correct: boolean;
  answer: string | null;
  revealed: boolean;
}

export interface QuizAttemptInput {
  score: number;
  total: number;
  answers: QuizAnswer[];
}

export interface QuizAttempt extends QuizAttemptInput {
  id: number;
  quizId: string;
  finishedAt: string;
}

export interface GenerateQuizInput {
  bodySex: BodySex;
  systems: SystemId[];
  count: number;
  mode: "mixed" | "find3d" | "multipleChoice";
  title?: string;
}

export interface CatalogStructure {
  id: string;
  nameEs: string;
  system: SystemId;
  side: "left" | "right" | "median";
  descriptionEs: string;
}
