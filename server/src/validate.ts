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

// ---- Cuentas ----

const password = { type: "string", minLength: 8, maxLength: 128 } as const;

export const credentialsSchema = {
  type: "object",
  required: ["username", "password"],
  additionalProperties: false,
  properties: {
    // Letras, números, punto, guion y guion bajo; sin espacios para evitar nombres ambiguos.
    username: { type: "string", pattern: "^[A-Za-z0-9._-]{3,32}$" },
    password,
  },
} as const;

// En el login no se exigen las reglas de formato: un dato que no las cumple es simplemente
// un usuario o una contraseña incorrectos.
export const loginSchema = {
  type: "object",
  required: ["username", "password"],
  additionalProperties: false,
  properties: {
    username: { type: "string", minLength: 1, maxLength: 64 },
    password: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const FIELD_ES: Record<string, string> = {
  username: "El usuario",
  password: "La contraseña",
  newPassword: "La nueva contraseña",
  currentPassword: "La contraseña actual",
  title: "El título",
  name: "El nombre",
  note: "La nota",
  structureId: "El identificador de la estructura",
  questions: "La lista de preguntas",
  count: "El número de preguntas",
  systems: "La lista de sistemas",
};

interface ValidationIssue {
  keyword: string;
  instancePath: string;
  params: Record<string, any>;
  message?: string;
}

// Traduce el primer error de validación de Fastify (Ajv) a un mensaje en español para la UI.
export function validationMessageEs(issues: ValidationIssue[]): string {
  const issue = issues[0];
  if (!issue) return "Datos no válidos.";
  const path = issue.instancePath.split("/").filter(Boolean);
  const field =
    issue.keyword === "required" ? issue.params.missingProperty : path[path.length - 1] ?? "";
  const name = FIELD_ES[field] ?? (field ? `El campo «${field}»` : "La petición");
  switch (issue.keyword) {
    case "required":
      return `${name} es obligatorio.`;
    case "minLength":
      return issue.params.limit === 1
        ? `${name} no puede estar vacío.`
        : `${name} debe tener al menos ${issue.params.limit} caracteres.`;
    case "maxLength":
      return `${name} no puede tener más de ${issue.params.limit} caracteres.`;
    case "pattern":
      return field === "username"
        ? "El usuario debe tener de 3 a 32 caracteres: letras, números, punto, guion o guion bajo (sin espacios)."
        : `${name} tiene un formato no válido.`;
    case "minimum":
      return `${name} debe ser como mínimo ${issue.params.limit}.`;
    case "maximum":
      return `${name} debe ser como máximo ${issue.params.limit}.`;
    case "minItems":
      return `${name} debe tener al menos ${issue.params.limit} elemento(s).`;
    case "enum":
      return `${name} tiene un valor no permitido.`;
    default:
      return `Datos no válidos (${issue.message ?? issue.keyword}).`;
  }
}

export const changePasswordSchema = {
  type: "object",
  required: ["currentPassword", "newPassword"],
  additionalProperties: false,
  properties: { currentPassword: { type: "string", maxLength: 128 }, newPassword: password },
} as const;

export const deleteAccountSchema = {
  type: "object",
  required: ["password"],
  additionalProperties: false,
  properties: { password: { type: "string", maxLength: 128 } },
} as const;

export const adminPasswordSchema = {
  type: "object",
  required: ["newPassword"],
  additionalProperties: false,
  properties: { newPassword: password },
} as const;

export const updateUserSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    role: { enum: ["estudiante", "docente", "admin"] },
    isActive: { type: "boolean" },
  },
} as const;

// ---- Vistas y notas ----

export const MAX_VIEW_STATE_BYTES = 20_000;

export const viewSchema = {
  type: "object",
  required: ["name", "state"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    // El contenido lo define la web (versión, cámara, capas…); aquí solo se limita el tamaño.
    state: { type: "object" },
  },
} as const;

export const viewPatchSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    state: { type: "object" },
  },
} as const;

export const noteSchema = {
  type: "object",
  required: ["note"],
  additionalProperties: false,
  properties: { note: { type: "string", maxLength: 5000 } },
} as const;

export const structureParams = {
  type: "object",
  required: ["structureId"],
  properties: { structureId: { type: "string", pattern: "^[A-Za-z0-9_.-]{1,128}$" } },
} as const;

export const visibilitySchema = {
  type: "object",
  required: ["isPublic"],
  additionalProperties: false,
  properties: { isPublic: { type: "boolean" } },
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
