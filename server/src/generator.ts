import { SYSTEM_LABEL_ES, type Catalog } from "./catalog.ts";
import type {
  CatalogStructure,
  Difficulty,
  GenerateQuizInput,
  QuizInput,
  QuizQuestion,
} from "./types.ts";

// Generador de cuestionarios por reglas (sin IA): elige estructuras al azar del catálogo
// según la dificultad y rellena plantillas de enunciado, pista, distractores y explicación.

export class GenerateError extends Error {}

type Rnd = () => number;

function shuffle<T>(arr: T[], rnd: Rnd): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pickOne = <T>(arr: T[], rnd: Rnd): T => arr[Math.floor(rnd() * arr.length)];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  basico: "básico",
  intermedio: "intermedio",
  avanzado: "avanzado",
};

// Estructuras candidatas por dificultad. Todas necesitan malla propia para poder hacer clic.
// "Conjunto de..." son grupos de piezas dispersas (p. ej. arterias digitales): solo en avanzado.
const DIFFICULTY_FILTER: Record<Difficulty, (s: CatalogStructure) => boolean> = {
  basico: (s) => s.clickSizeCm >= 3 && !/^conjunto/i.test(s.nameEs),
  intermedio: (s) => s.clickSizeCm >= 1,
  avanzado: () => true,
};

const REGION_PHRASE: Record<string, string> = {
  "cabeza y cuello": "la cabeza y el cuello",
  tórax: "el tórax",
  abdomen: "el abdomen",
  pelvis: "la pelvis",
  "miembro superior": "el miembro superior",
  "miembro inferior": "el miembro inferior",
};

const SIDE_WORDS = /\b(derech[oa]s?|izquierd[oa]s?|right|left)\b/gi;
const STOP_WORDS = new Set(["conjunto", "estructura", "porción", "parte", "superior", "inferior"]);

// Nombre sin el lado: "Fémur derecho" y "Fémur izquierdo" comparten "fémur".
const baseName = (s: CatalogStructure) =>
  s.nameEs.toLowerCase().replace(SIDE_WORDS, "").replace(/\s+/g, " ").trim();

const keyWords = (s: CatalogStructure) =>
  new Set(baseName(s).split(/[^\p{L}]+/u).filter((w) => w.length >= 5 && !STOP_WORDS.has(w)));

const FIND3D_PROMPTS: Array<(name: string, sys: string) => string> = [
  (n) => `Haz clic en el modelo 3D sobre: ${n}.`,
  (n) => `Localiza en el modelo 3D: ${n}.`,
  (n) => `Señala con un clic la estructura: ${n}.`,
  (n, sys) => `Dentro del ${sys}, encuentra y haz clic en: ${n}.`,
  (n) => `¿Dónde está ${n}? Haz clic sobre la estructura en el visor 3D.`,
];

const CHOICE_PROMPTS: Array<(sys: string, region: string) => string> = [
  () => "¿Cómo se llama la estructura resaltada en el visor 3D?",
  (sys) => `Identifica la estructura del ${sys} que aparece resaltada.`,
  (sys) => `¿Qué estructura del ${sys} está resaltada en el modelo?`,
  (_, region) =>
    region ? `Observa la estructura resaltada en ${region}. ¿Cuál es?` : "¿Cuál es la estructura resaltada?",
];

function sideSentence(side: CatalogStructure["side"]): string {
  if (side === "right") return "Está en el lado derecho del cuerpo (a la izquierda de tu pantalla en vista frontal).";
  if (side === "left") return "Está en el lado izquierdo del cuerpo (a la derecha de tu pantalla en vista frontal).";
  return "Está en la línea media del cuerpo.";
}

function hintFor(
  st: CatalogStructure,
  type: QuizQuestion["type"],
  catalog: Map<string, CatalogStructure>
): string {
  const parts = [`Pertenece al ${SYSTEM_LABEL_ES[st.system]}.`];
  if (st.sizeCm) parts.push(`Mide unos ${Math.max(1, Math.round(st.sizeCm))} cm.`);
  if (type === "find3d") {
    // Las estructuras muy grandes ocupan varias regiones: la región de su centro confundiría.
    if (st.region && st.sizeCm < 45) parts.push(`Se encuentra en ${REGION_PHRASE[st.region]}.`);
    parts.push(sideSentence(st.side));
    const parent = catalog.get(st.parentId);
    if (parent) parts.push(`Forma parte de: ${parent.nameEs}.`);
  } else {
    // En opción múltiple la pieza ya está resaltada: la pista ayuda a elegir el nombre.
    parts.push(`Su nombre empieza por «${st.nameEs.charAt(0).toUpperCase()}».`);
  }
  return parts.join(" ");
}

// Primeras frases de la descripción (sin marcas markdown), hasta ~320 caracteres.
function shortDescription(st: CatalogStructure): string {
  const text = st.descriptionEs.replace(/\*/g, "").trim();
  if (!text) return `${st.nameEs} (${st.id}) pertenece al ${SYSTEM_LABEL_ES[st.system]}.`;
  const sentences = text.match(/[^.]+\.(\s|$)/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).length > 320) break;
    out += s;
  }
  return out.trim();
}

// Tres distractores. En básico, nombres del mismo nivel (reconocibles) y nunca el mismo hueso u
// órgano del otro lado; en avanzado, los más parecidos: mismo padre, palabras o región en común.
function distractorsFor(
  st: CatalogStructure,
  difficulty: Difficulty,
  all: CatalogStructure[],
  rnd: Rnd
): string[] {
  const base = baseName(st);
  const words = keyWords(st);
  const sameSystem = all.filter((s) => s.system === st.system && s.nameEs !== st.nameEs);
  let ranked: CatalogStructure[];

  if (difficulty === "avanzado") {
    const score = (c: CatalogStructure) => {
      let n = rnd() * 0.9;
      if (st.parentId && c.parentId === st.parentId) n += 3;
      for (const w of keyWords(c)) if (words.has(w)) n += 2;
      if (c.region === st.region) n += 1;
      return n;
    };
    ranked = sameSystem.map((c) => [score(c), c] as const).sort((a, b) => b[0] - a[0]).map(([, c]) => c);
  } else {
    const pool = sameSystem.filter((c) => DIFFICULTY_FILTER[difficulty](c) && c.hasMesh);
    ranked = shuffle(difficulty === "basico" ? pool.filter((c) => baseName(c) !== base) : pool, rnd);
  }
  // Si el sistema no tiene suficientes, se completa con otros sistemas.
  ranked.push(...shuffle(all.filter((s) => s.system !== st.system), rnd));

  const names = new Set([st.nameEs]);
  const out: string[] = [];
  for (const c of ranked) {
    if (out.length === 3) break;
    if (names.has(c.nameEs)) continue;
    names.add(c.nameEs);
    out.push(c.nameEs);
  }
  return out;
}

export function generateQuiz(catalog: Catalog, input: GenerateQuizInput, rnd: Rnd = Math.random): QuizInput {
  const difficulty = input.difficulty ?? "intermedio";
  const all = catalog.bySex[input.bodySex];
  const byId = catalog.byId[input.bodySex];
  const pool = all.filter(
    (s) => s.hasMesh && input.systems.includes(s.system) && DIFFICULTY_FILTER[difficulty](s)
  );

  // Sin repetir estructura ni su simétrica (salvo en avanzado, donde solo se evita el mismo nombre).
  const seen = new Set<string>();
  const targets = shuffle(pool, rnd).filter((s) => {
    const key = difficulty === "avanzado" ? s.nameEs : baseName(s);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (targets.length < input.count) {
    throw new GenerateError(
      `Con la dificultad ${DIFFICULTY_LABEL[difficulty]} solo hay ${targets.length} estructuras distintas en los sistemas elegidos. Pide ${targets.length} preguntas o menos, añade sistemas o sube la dificultad.`
    );
  }

  const questions: QuizQuestion[] = targets.slice(0, input.count).map((st, i) => {
    const type = input.mode === "mixed" ? (i % 2 === 0 ? "find3d" : "multipleChoice") : input.mode;
    const sys = SYSTEM_LABEL_ES[st.system];
    const base = {
      id: `q${i + 1}`,
      hint: hintFor(st, type, byId),
      bodySex: input.bodySex,
      enabledSystems: [st.system],
      targetStructureId: st.id,
      targetNameEs: st.nameEs,
      explanation: shortDescription(st),
    };
    if (type === "find3d") {
      return { ...base, type, prompt: pickOne(FIND3D_PROMPTS, rnd)(st.nameEs.toUpperCase(), sys) };
    }
    return {
      ...base,
      type,
      prompt: pickOne(CHOICE_PROMPTS, rnd)(sys, REGION_PHRASE[st.region] ?? ""),
      options: shuffle([st.nameEs, ...distractorsFor(st, difficulty, all, rnd)], rnd),
    };
  });

  const sexEs = input.bodySex === "female" ? "femenino" : "masculino";
  const systemsEs = input.systems.map((s) => SYSTEM_LABEL_ES[s]).join(", ");
  const modeEs =
    input.mode === "mixed" ? "clic 3D y opción múltiple" : input.mode === "find3d" ? "clic 3D" : "opción múltiple";
  return {
    title: input.title?.trim() || `Cuestionario generado: ${systemsEs}`,
    subtitle: `Modelo ${sexEs} · nivel ${DIFFICULTY_LABEL[difficulty]} · ${input.count} preguntas (${modeEs})`,
    questions,
  };
}
