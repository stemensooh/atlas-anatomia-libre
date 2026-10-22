import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Plus, Shuffle, Trash2, X } from "lucide-react";
import { AnatomyStructure, SYSTEM_META, SystemId } from "../data/types";
import { AnatomyQuiz, QuizQuestion } from "../data/didacticData";
import {
  ApiError,
  createQuiz,
  generateQuiz,
  GenerateQuizInput,
  updateQuiz,
} from "../data/quizApi";
import { BodySex } from "../store/useViewerStore";

export type EditorMode =
  | { kind: "generate" }
  | { kind: "create" }
  | { kind: "edit"; quiz: AnatomyQuiz };

type CatalogBySex = Record<BodySex, AnatomyStructure[]>;

const SYSTEM_IDS = Object.keys(SYSTEM_META) as SystemId[];

const newId = () => `q-${Math.random().toString(36).slice(2, 8)}`;

function emptyQuestion(bodySex: BodySex): QuizQuestion {
  return {
    id: newId(),
    type: "find3d",
    prompt: "",
    hint: "",
    bodySex,
    enabledSystems: ["skeletal"],
    targetStructureId: "",
    targetNameEs: "",
    explanation: "",
  };
}

// Tres nombres al azar del mismo sistema que la respuesta correcta.
function randomDistractors(target: AnatomyStructure, catalog: AnatomyStructure[]): string[] {
  const pool = catalog.filter(
    (s) => s.system === target.system && s.nameEs !== target.nameEs
  );
  const out = new Set<string>();
  while (out.size < 3 && out.size < pool.length) {
    out.add(pool[Math.floor(Math.random() * pool.length)].nameEs);
  }
  return [...out];
}

function ErrorBox({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div className="editor-error">
      <strong>{error.message}</strong>
      {error.details.length > 0 && (
        <ul>
          {error.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SystemChecks({
  value,
  onChange,
}: {
  value: SystemId[];
  onChange: (v: SystemId[]) => void;
}) {
  return (
    <div className="editor-systems">
      {SYSTEM_IDS.map((sys) => (
        <label key={sys} className="editor-check">
          <input
            type="checkbox"
            checked={value.includes(sys)}
            onChange={(e) =>
              onChange(
                e.target.checked ? [...value, sys] : value.filter((s) => s !== sys)
              )
            }
          />
          <span
            className="color-dot"
            style={{ backgroundColor: SYSTEM_META[sys].colorHex }}
          />
          {SYSTEM_META[sys].labelEs.replace(/^Sistema /, "")}
        </label>
      ))}
    </div>
  );
}

function GenerateForm({
  onSaved,
  onCancel,
}: {
  onSaved: (q: AnatomyQuiz) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<GenerateQuizInput>({
    bodySex: "male",
    systems: ["skeletal"],
    count: 5,
    mode: "mixed",
    difficulty: "intermedio",
    title: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await generateQuiz({ ...input, title: input.title || undefined }));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="editor-help">
        Crea un cuestionario al azar con estructuras del catálogo (BodyParts3D / HuBMAP) y lo
        guarda en la base de datos. Funciona por reglas, sin IA: la dificultad se calcula con el
        tamaño real de cada pieza en el modelo 3D y las opciones falsas son del mismo sistema.
      </p>
      <div className="editor-grid">
        <label className="editor-field">
          <span>Modelo</span>
          <select
            value={input.bodySex}
            onChange={(e) => setInput({ ...input, bodySex: e.target.value as BodySex })}
          >
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
          </select>
        </label>
        <label className="editor-field">
          <span>Número de preguntas</span>
          <input
            type="number"
            min={3}
            max={20}
            value={input.count}
            onChange={(e) => setInput({ ...input, count: Number(e.target.value) })}
          />
        </label>
        <label className="editor-field">
          <span>Tipo de preguntas</span>
          <select
            value={input.mode}
            onChange={(e) =>
              setInput({ ...input, mode: e.target.value as GenerateQuizInput["mode"] })
            }
          >
            <option value="mixed">Mixto</option>
            <option value="find3d">Solo clic en 3D</option>
            <option value="multipleChoice">Solo opción múltiple</option>
          </select>
        </label>
        <label className="editor-field">
          <span>Dificultad</span>
          <select
            value={input.difficulty}
            onChange={(e) =>
              setInput({
                ...input,
                difficulty: e.target.value as GenerateQuizInput["difficulty"],
              })
            }
          >
            <option value="basico">Básico: estructuras grandes y conocidas</option>
            <option value="intermedio">Intermedio: de 1 cm en adelante</option>
            <option value="avanzado">Avanzado: todas, con distractores parecidos</option>
          </select>
        </label>
        <label className="editor-field">
          <span>Título (opcional)</span>
          <input
            type="text"
            value={input.title}
            placeholder="Se genera automáticamente"
            onChange={(e) => setInput({ ...input, title: e.target.value })}
          />
        </label>
      </div>
      <div className="editor-field">
        <span>Sistemas</span>
        <SystemChecks
          value={input.systems}
          onChange={(systems) => setInput({ ...input, systems })}
        />
      </div>
      <ErrorBox error={error} />
      <div className="editor-footer">
        <button className="btn-xs" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="btn-credits"
          disabled={busy || input.systems.length === 0}
          onClick={submit}
        >
          {busy ? "Generando…" : "Generar y guardar"}
        </button>
      </div>
    </>
  );
}

function StructurePicker({
  catalog,
  value,
  onPick,
}: {
  catalog: AnatomyStructure[];
  value: string;
  onPick: (st: AnatomyStructure) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog
      .filter(
        (s) =>
          s.nameEs.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [catalog, query]);
  const current = catalog.find((s) => s.id === value);

  return (
    <div className="editor-field">
      <span>Estructura objetivo</span>
      <input
        type="text"
        value={query}
        placeholder={current ? `${current.nameEs} (${current.id})` : "Buscar por nombre o FMA…"}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <div className="editor-results">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPick(s);
                setQuery("");
              }}
            >
              <span
                className="color-dot"
                style={{ backgroundColor: SYSTEM_META[s.system].colorHex }}
              />
              {s.nameEs} <small>{s.id}</small>
            </button>
          ))}
        </div>
      )}
      {current && (
        <small className="editor-current">
          Seleccionada: <strong>{current.nameEs}</strong> · {SYSTEM_META[current.system].labelEs}
        </small>
      )}
    </div>
  );
}

function QuestionEditor({
  q,
  index,
  count,
  catalogBySex,
  onChange,
  onMove,
  onRemove,
}: {
  q: QuizQuestion;
  index: number;
  count: number;
  catalogBySex: CatalogBySex;
  onChange: (q: QuizQuestion) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const catalog = catalogBySex[q.bodySex];
  const target = catalog.find((s) => s.id === q.targetStructureId);
  const options = q.options ?? [];

  const pick = (st: AnatomyStructure) => {
    const next: QuizQuestion = {
      ...q,
      targetStructureId: st.id,
      targetNameEs: st.nameEs,
      enabledSystems: q.enabledSystems.includes(st.system)
        ? q.enabledSystems
        : [st.system],
      explanation: q.explanation || st.descriptionEs.replace(/\*/g, ""),
    };
    if (!q.prompt) {
      next.prompt =
        q.type === "find3d"
          ? `Haz clic en el modelo 3D sobre: ${st.nameEs.toUpperCase()}.`
          : "¿Cómo se llama la estructura resaltada en el visor 3D?";
    }
    if (q.type === "multipleChoice") {
      next.options = [st.nameEs, ...randomDistractors(st, catalog)];
    }
    onChange(next);
  };

  return (
    <div className="editor-question">
      <div className="editor-question-header">
        <strong>Pregunta {index + 1}</strong>
        <div className="editor-question-actions">
          <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} title="Subir">
            <ArrowUp size={13} />
          </button>
          <button
            className="icon-btn"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            title="Bajar"
          >
            <ArrowDown size={13} />
          </button>
          <button className="icon-btn" onClick={onRemove} title="Eliminar pregunta">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="editor-grid">
        <label className="editor-field">
          <span>Tipo</span>
          <select
            value={q.type}
            onChange={(e) => {
              const type = e.target.value as QuizQuestion["type"];
              onChange({
                ...q,
                type,
                options:
                  type === "multipleChoice" && target
                    ? [target.nameEs, ...randomDistractors(target, catalog)]
                    : undefined,
              });
            }}
          >
            <option value="find3d">Clic en el modelo 3D</option>
            <option value="multipleChoice">Opción múltiple</option>
          </select>
        </label>
        <label className="editor-field">
          <span>Modelo</span>
          <select
            value={q.bodySex}
            onChange={(e) =>
              onChange({
                ...q,
                bodySex: e.target.value as BodySex,
                targetStructureId: "",
                targetNameEs: "",
                options: undefined,
              })
            }
          >
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
          </select>
        </label>
      </div>

      <StructurePicker catalog={catalog} value={q.targetStructureId} onPick={pick} />

      <label className="editor-field">
        <span>Enunciado</span>
        <textarea
          rows={2}
          value={q.prompt}
          onChange={(e) => onChange({ ...q, prompt: e.target.value })}
        />
      </label>

      {q.type === "multipleChoice" && (
        <div className="editor-field">
          <span>
            Opciones (la primera es la correcta; en el cuestionario se muestran desordenadas)
          </span>
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              type="text"
              value={i === 0 ? q.targetNameEs : options[i] ?? ""}
              disabled={i === 0}
              placeholder={i === 0 ? "Elige la estructura objetivo" : `Distractor ${i}`}
              onChange={(e) => {
                // Se guardan las 4 casillas (aunque estén vacías) para no desplazar lo escrito.
                const next = [0, 1, 2, 3].map((k) => (k === 0 ? q.targetNameEs : options[k] ?? ""));
                next[i] = e.target.value;
                onChange({ ...q, options: next });
              }}
            />
          ))}
          {target && (
            <button
              type="button"
              className="btn-xs"
              onClick={() =>
                onChange({ ...q, options: [target.nameEs, ...randomDistractors(target, catalog)] })
              }
            >
              <Shuffle size={13} /> Distractores al azar del mismo sistema
            </button>
          )}
        </div>
      )}

      <label className="editor-field">
        <span>Pista (opcional)</span>
        <input
          type="text"
          value={q.hint}
          onChange={(e) => onChange({ ...q, hint: e.target.value })}
        />
      </label>

      <label className="editor-field">
        <span>Explicación tras responder</span>
        <textarea
          rows={3}
          value={q.explanation}
          onChange={(e) => onChange({ ...q, explanation: e.target.value })}
        />
      </label>

      <div className="editor-field">
        <span>Sistemas visibles durante la pregunta</span>
        <SystemChecks
          value={q.enabledSystems}
          onChange={(enabledSystems) => onChange({ ...q, enabledSystems })}
        />
      </div>
    </div>
  );
}

function QuizForm({
  initial,
  catalogBySex,
  onSaved,
  onCancel,
}: {
  initial: AnatomyQuiz | null;
  catalogBySex: CatalogBySex;
  onSaved: (q: AnatomyQuiz) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initial?.questions ?? [emptyQuestion("male")]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const setAt = (i: number, q: QuizQuestion) =>
    setQuestions((qs) => qs.map((x, k) => (k === i ? q : x)));

  const move = (i: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const next = qs.slice();
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    const body = {
      title: title.trim(),
      subtitle: subtitle.trim() || `${questions.length} preguntas`,
      questions: questions.map((q) =>
        q.type === "multipleChoice"
          ? { ...q, options: (q.options ?? []).map((o) => o.trim()).filter(Boolean) }
          : { ...q, options: undefined }
      ),
    };
    try {
      onSaved(initial ? await updateQuiz(initial.id, body) : await createQuiz(body));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="editor-grid">
        <label className="editor-field">
          <span>Título</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="editor-field">
          <span>Subtítulo</span>
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </label>
      </div>

      {questions.map((q, i) => (
        <QuestionEditor
          key={q.id}
          q={q}
          index={i}
          count={questions.length}
          catalogBySex={catalogBySex}
          onChange={(nq) => setAt(i, nq)}
          onMove={(dir) => move(i, dir)}
          onRemove={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}
        />
      ))}

      <button
        className="btn-xs"
        onClick={() =>
          setQuestions((qs) => [
            ...qs,
            emptyQuestion(qs[qs.length - 1]?.bodySex ?? "male"),
          ])
        }
      >
        <Plus size={13} /> Añadir pregunta
      </button>

      <ErrorBox error={error} />
      <div className="editor-footer">
        <button className="btn-xs" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="btn-credits"
          disabled={busy || !title.trim() || questions.length === 0}
          onClick={submit}
        >
          {busy ? "Guardando…" : "Guardar en la base de datos"}
        </button>
      </div>
    </>
  );
}

export function QuizEditorModal({
  mode,
  catalogBySex,
  onClose,
  onSaved,
}: {
  mode: EditorMode;
  catalogBySex: CatalogBySex;
  onClose: () => void;
  onSaved: (q: AnatomyQuiz) => void;
}) {
  const heading =
    mode.kind === "generate"
      ? "Generar cuestionario"
      : mode.kind === "create"
      ? "Nuevo cuestionario"
      : "Editar cuestionario";

  // Portal al body: el panel lateral no debe recortar ni desplazar el modal.
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2>{heading}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body quiz-editor">
          {mode.kind === "generate" ? (
            <GenerateForm onSaved={onSaved} onCancel={onClose} />
          ) : (
            <QuizForm
              initial={mode.kind === "edit" ? mode.quiz : null}
              catalogBySex={catalogBySex}
              onSaved={onSaved}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
