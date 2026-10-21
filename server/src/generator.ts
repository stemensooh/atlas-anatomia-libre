import { SYSTEM_LABEL_ES, type Catalog } from "./catalog.ts";
import type { CatalogStructure, GenerateQuizInput, QuizInput, QuizQuestion } from "./types.ts";

export class GenerateError extends Error {}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sideHint(side: CatalogStructure["side"]): string {
  if (side === "right") return ", en el lado derecho del cuerpo (a la izquierda de tu pantalla en vista frontal)";
  if (side === "left") return ", en el lado izquierdo del cuerpo (a la derecha de tu pantalla en vista frontal)";
  return ", en la línea media del cuerpo";
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

export function generateQuiz(
  catalog: Catalog,
  input: GenerateQuizInput,
  rnd: () => number = Math.random
): QuizInput {
  const all = catalog.bySex[input.bodySex];
  const pool = all.filter((s) => input.systems.includes(s.system));
  if (pool.length < input.count) {
    throw new GenerateError(
      `Solo hay ${pool.length} estructuras en los sistemas elegidos; pide ${pool.length} preguntas o menos.`
    );
  }

  // Sin nombres repetidos entre las preguntas de un mismo cuestionario.
  const seen = new Set<string>();
  const targets = shuffle(pool, rnd).filter((s) => !seen.has(s.nameEs) && seen.add(s.nameEs));
  if (targets.length < input.count) {
    throw new GenerateError(`Solo hay ${targets.length} estructuras con nombres distintos en los sistemas elegidos.`);
  }

  const questions: QuizQuestion[] = targets.slice(0, input.count).map((st, i) => {
    const type =
      input.mode === "mixed" ? (i % 2 === 0 ? "find3d" : "multipleChoice") : input.mode;
    const hint = `Pertenece al ${SYSTEM_LABEL_ES[st.system]}${sideHint(st.side)}.`;
    const base = {
      id: `q${i + 1}`,
      hint,
      bodySex: input.bodySex,
      enabledSystems: [st.system],
      targetStructureId: st.id,
      targetNameEs: st.nameEs,
      explanation: shortDescription(st),
    };
    if (type === "find3d") {
      return { ...base, type, prompt: `Haz clic en el modelo 3D sobre: ${st.nameEs.toUpperCase()}.` };
    }

    // Distractores: primero del mismo sistema, si no alcanzan, de cualquier otro.
    const names = new Set([st.nameEs]);
    const distractors: string[] = [];
    for (const cand of [
      ...shuffle(all.filter((s) => s.system === st.system), rnd),
      ...shuffle(all.filter((s) => s.system !== st.system), rnd),
    ]) {
      if (distractors.length === 3) break;
      if (names.has(cand.nameEs)) continue;
      names.add(cand.nameEs);
      distractors.push(cand.nameEs);
    }
    return {
      ...base,
      type,
      prompt: "¿Cómo se llama la estructura resaltada en el visor 3D?",
      options: shuffle([st.nameEs, ...distractors], rnd),
    };
  });

  const sexEs = input.bodySex === "female" ? "femenino" : "masculino";
  const systemsEs = input.systems.map((s) => SYSTEM_LABEL_ES[s]).join(", ");
  return {
    title: input.title?.trim() || `Cuestionario generado: ${systemsEs}`,
    subtitle: `Modelo ${sexEs} · ${input.count} preguntas al azar (${
      input.mode === "mixed" ? "clic 3D y opción múltiple" : input.mode === "find3d" ? "clic 3D" : "opción múltiple"
    })`,
    questions,
  };
}
