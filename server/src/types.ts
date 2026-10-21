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
  userId: number | null; // dueño (null = sin dueño); se usará con la autenticación
  createdAt: string;
  updatedAt: string;
  questions: QuizQuestion[];
}

export interface QuizSummary {
  id: string;
  title: string;
  subtitle: string;
  source: QuizSource;
  userId: number | null;
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
  userId: number | null;
  finishedAt: string;
}

export type Difficulty = "basico" | "intermedio" | "avanzado";

export interface GenerateQuizInput {
  bodySex: BodySex;
  systems: SystemId[];
  count: number;
  mode: "mixed" | "find3d" | "multipleChoice";
  difficulty?: Difficulty;
  title?: string;
}

export interface CatalogStructure {
  id: string;
  nameEs: string;
  system: SystemId;
  side: "left" | "right" | "median";
  parentId: string;
  descriptionEs: string;
  // Calculados desde los .glb (catalog.ts). Las estructuras sin malla propia son grupos
  // de otras piezas: no se pueden seleccionar con un clic.
  hasMesh: boolean;
  sizeCm: number; // dimensión mayor de la caja envolvente
  clickSizeCm: number; // dimensión intermedia: indica lo fácil que es acertar con un clic
  region: string; // cabeza y cuello, tórax, abdomen, pelvis, miembro superior/inferior
}
