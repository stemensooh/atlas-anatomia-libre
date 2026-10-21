import type { Catalog } from "./catalog.ts";
import { SYSTEM_IDS, type QuizInput } from "./types.ts";

// Esquemas JSON para Fastify (forma de los datos). Las reglas que dependen del catálogo van en checkQuiz().
const questionSchema = {
  type: "object",
  required: ["id", "type", "prompt", "bodySex", "enabledSystems", "targetStructureId", "targetNameEs"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    type: { enum: ["find3d", "multipleChoice"] },
    prompt: { type: "string", minLength: 1, maxLength: 500 },
    hint: { type: "string", maxLength: 500, default: "" },
    bodySex: { enum: ["male", "female"] },
    enabledSystems: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { enum: SYSTEM_IDS },
    },
    targetStructureId: { type: "string", minLength: 1, maxLength: 128 },
    targetNameEs: { type: "string", minLength: 1, maxLength: 200 },
    options: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 200 },
    },
    explanation: { type: "string", maxLength: 2000, default: "" },
  },
} as const;

export const quizInputSchema = {
  type: "object",
  required: ["title", "questions"],
  additionalProperties: false,
  properties: {
    id: { type: "string", pattern: "^[a-z0-9-]{3,64}$" },
    title: { type: "string", minLength: 1, maxLength: 200 },
    subtitle: { type: "string", maxLength: 300, default: "" },
    questions: { type: "array", minItems: 1, maxItems: 50, items: questionSchema },
  },
} as const;

export const generateInputSchema = {
  type: "object",
  required: ["bodySex", "systems", "count"],
  additionalProperties: false,
  properties: {
    bodySex: { enum: ["male", "female"] },
    systems: { type: "array", minItems: 1, uniqueItems: true, items: { enum: SYSTEM_IDS } },
    count: { type: "integer", minimum: 3, maximum: 20 },
    mode: { enum: ["mixed", "find3d", "multipleChoice"], default: "mixed" },
    difficulty: { enum: ["basico", "intermedio", "avanzado"], default: "intermedio" },
    title: { type: "string", maxLength: 200 },
  },
} as const;

export const attemptInputSchema = {
  type: "object",
  required: ["score", "total", "answers"],
  additionalProperties: false,
  properties: {
    score: { type: "integer", minimum: 0 },
    total: { type: "integer", minimum: 1 },
    answers: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["questionId", "correct", "revealed"],
        additionalProperties: false,
        properties: {
          questionId: { type: "string", maxLength: 64 },
          correct: { type: "boolean" },
          answer: { type: ["string", "null"], maxLength: 200 },
          revealed: { type: "boolean" },
        },
      },
    },
  },
} as const;

// Devuelve la lista de errores (vacía si el cuestionario es válido).
export function checkQuiz(catalog: Catalog, quiz: QuizInput): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  quiz.questions.forEach((q, i) => {
    const n = `Pregunta ${i + 1}`;
    if (ids.has(q.id)) errors.push(`${n}: id "${q.id}" repetido.`);
    ids.add(q.id);

    const st = catalog.byId[q.bodySex].get(q.targetStructureId);
    if (!st) {
      errors.push(`${n}: la estructura ${q.targetStructureId} no existe en el modelo ${q.bodySex === "female" ? "femenino" : "masculino"}.`);
    } else if (!st.hasMesh) {
      errors.push(`${n}: ${st.nameEs} es un grupo sin malla propia y no se puede seleccionar; elige una de sus partes.`);
    } else if (!q.enabledSystems.includes(st.system)) {
      errors.push(`${n}: hay que activar el sistema "${st.system}" para que se vea ${st.nameEs}.`);
    }

    if (q.type === "multipleChoice") {
      const opts = q.options ?? [];
      if (opts.length < 2) errors.push(`${n}: la opción múltiple necesita al menos 2 opciones.`);
      if (!opts.includes(q.targetNameEs)) errors.push(`${n}: las opciones deben incluir la respuesta correcta.`);
      if (new Set(opts).size !== opts.length) errors.push(`${n}: hay opciones repetidas.`);
    }
  });
  return errors;
}
