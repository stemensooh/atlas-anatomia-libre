import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Database,
  Globe,
  Lightbulb,
  Lock,
  LogIn,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { AnatomyStructure } from "../data/types";
import { AnatomyQuiz, QuizQuestion } from "../data/didacticData";
import {
  deleteQuiz,
  listAttempts,
  loadQuizzes,
  QuizAnswer,
  QuizAttempt,
  saveAttempt,
  setQuizVisibility,
} from "../data/quizApi";
import { hasRole } from "../data/authApi";
import { useAuthStore } from "../store/useAuthStore";
import { useViewerStore } from "../store/useViewerStore";
import { QuizEditorModal, EditorMode } from "./QuizEditor";
import { QuizResultsModal } from "./QuizResultsModal";
import { useLayout } from "../hooks/useLayout";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SOURCE_LABEL: Record<string, string> = {
  seed: "Incluido",
  manual: "Manual",
  generated: "Generado",
};

export function QuizPanel({
  structureById,
  catalogBySex,
}: {
  structureById: Map<string, AnatomyStructure>;
  catalogBySex: Record<"male" | "female", AnatomyStructure[]>;
}) {
  const rightTab = useViewerStore((s) => s.rightTab);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const applySceneConfig = useViewerStore((s) => s.applySceneConfig);
  const setQuizClickHandler = useViewerStore((s) => s.setQuizClickHandler);
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.ready);
  const openModal = useAuthStore((s) => s.openModal);

  const [quizzes, setQuizzes] = useState<AnatomyQuiz[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  // Una respuesta por pregunta: una vez contestada no se puede volver a puntuar.
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [finished, setFinished] = useState(false);
  const [runNonce, setRunNonce] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [resultsFor, setResultsFor] = useState<AnatomyQuiz | null>(null);
  // En móvil/tablet la lista se pliega al cuestionario activo para que la pregunta quede a la vista.
  const compact = useLayout() !== "desktop";
  const [listOpen, setListOpen] = useState(false);
  const choose = (quiz: AnatomyQuiz) => {
    startQuiz(quiz);
    setListOpen(false);
  };

  const reload = useCallback(async (selectId?: string) => {
    const res = await loadQuizzes();
    setQuizzes(res.quizzes);
    setOnline(res.online);
    setActiveQuizId((prev) => {
      const want = selectId ?? prev;
      return res.quizzes.some((q) => q.id === want)
        ? want
        : res.quizzes[0]?.id ?? null;
    });
  }, []);

  // Al iniciar o cerrar sesión cambian los cuestionarios visibles y sus permisos.
  useEffect(() => {
    if (authReady) reload();
  }, [reload, authReady, user?.id]);

  const activeQuiz = quizzes.find((q) => q.id === activeQuizId) || null;
  const currentQuestion: QuizQuestion | null =
    activeQuiz?.questions[questionIdx] || null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const feedbackRef = useRef<HTMLDivElement>(null);

  // En móvil el panel puede estar cerrado al responder (se abre justo después).
  const sheetPanel = useViewerStore((s) => s.sheet.panel);

  // Al responder, el resultado puede quedar fuera de la vista (debajo de la lista de
  // cuestionarios, o del panel a media altura en móvil): se desplaza el panel hasta él en
  // cuanto es visible (un elemento oculto no se puede desplazar a la vista).
  useEffect(() => {
    if (!currentAnswer) return;
    const frame = requestAnimationFrame(() => {
      const el = feedbackRef.current;
      if (el && el.offsetParent !== null) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentAnswer, sheetPanel]);
  const score = Object.values(answers).filter((a) => a.correct).length;
  const total = activeQuiz?.questions.length ?? 0;

  // Orden aleatorio de las opciones, estable mientras no cambie la pregunta.
  const shuffledOptions = useMemo(
    () => (currentQuestion?.options ? shuffle(currentQuestion.options) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentQuestion, runNonce]
  );

  const applyQuestionScene = useCallback(
    (q: QuizQuestion, answered: boolean) => {
      applySceneConfig({
        bodySex: q.bodySex,
        enabledSystems: q.enabledSystems,
        // En opción múltiple se resalta la estructura que hay que nombrar; en find3d
        // solo se muestra cuando la pregunta ya está contestada.
        selectedId:
          q.type === "multipleChoice" || answered ? q.targetStructureId : null,
        cameraPreset: "front",
        isolate: false,
      });
    },
    [applySceneConfig]
  );

  const startQuiz = (quiz: AnatomyQuiz) => {
    setActiveQuizId(quiz.id);
    setQuestionIdx(0);
    setAnswers({});
    setFinished(false);
    setShowHint(false);
    setSaveStatus(null);
    setRunNonce((n) => n + 1);
    if (quiz.questions[0]) applyQuestionScene(quiz.questions[0], false);
  };

  // Al entrar en la pestaña, o al cambiar de cuestionario, se prepara la escena de la pregunta actual.
  useEffect(() => {
    if (rightTab !== "quiz" || !currentQuestion || finished) return;
    applyQuestionScene(currentQuestion, Boolean(answers[currentQuestion.id]));
    // Solo al entrar en la pestaña o cambiar de pregunta, no en cada respuesta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightTab, activeQuizId, questionIdx]);

  // Historial de intentos del cuestionario activo.
  useEffect(() => {
    if (!online || !user || !activeQuizId) {
      setAttempts([]);
      return;
    }
    listAttempts(activeQuizId)
      .then(setAttempts)
      .catch(() => setAttempts([]));
  }, [online, user, activeQuizId]);

  const recordAnswer = useCallback(
    (q: QuizQuestion, a: Omit<QuizAnswer, "questionId">) => {
      setAnswers((prev) =>
        prev[q.id] ? prev : { ...prev, [q.id]: { questionId: q.id, ...a } }
      );
    },
    []
  );

  // Solo los clics directos en el modelo 3D responden una pregunta find3d.
  useEffect(() => {
    if (
      rightTab === "quiz" &&
      !finished &&
      currentQuestion?.type === "find3d" &&
      !currentAnswer
    ) {
      setQuizClickHandler((clickedId: string) => {
        const clicked = structureById.get(clickedId);
        const correct =
          clickedId === currentQuestion.targetStructureId ||
          clicked?.nameEs === currentQuestion.targetNameEs;
        recordAnswer(currentQuestion, {
          correct,
          answer: clicked ? clicked.nameEs : clickedId,
          revealed: false,
        });
      });
    } else {
      setQuizClickHandler(null);
    }
    return () => setQuizClickHandler(null);
  }, [
    rightTab,
    finished,
    currentQuestion,
    currentAnswer,
    structureById,
    recordAnswer,
    setQuizClickHandler,
  ]);

  const finishQuiz = async () => {
    if (!activeQuiz) return;
    setFinished(true);
    if (!online) {
      setSaveStatus("Sin servidor: el resultado no se ha guardado.");
      return;
    }
    if (!user) {
      setSaveStatus("Inicia sesión para guardar tus resultados.");
      return;
    }
    const list = activeQuiz.questions.map(
      (q) =>
        answers[q.id] || { questionId: q.id, correct: false, answer: null, revealed: false }
    );
    try {
      await saveAttempt(activeQuiz.id, { score, total, answers: list });
      setSaveStatus("Resultado guardado en la base de datos.");
      setAttempts(await listAttempts(activeQuiz.id));
    } catch (err) {
      setSaveStatus(`No se pudo guardar el resultado: ${(err as Error).message}`);
    }
  };

  const onDelete = async (quiz: AnatomyQuiz) => {
    if (!window.confirm(`¿Borrar "${quiz.title}" y todos sus resultados?`)) return;
    try {
      await deleteQuiz(quiz.id);
      await reload(quiz.id === activeQuizId ? undefined : activeQuizId ?? undefined);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const onToggleVisibility = async (quiz: AnatomyQuiz) => {
    try {
      await setQuizVisibility(quiz.id, !quiz.isPublic);
      await reload(activeQuizId ?? undefined);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const bestAttempt = attempts.reduce<QuizAttempt | null>(
    (best, a) => (!best || a.score / a.total > best.score / best.total ? a : best),
    null
  );

  return (
    <div
      className="didactic-section"
      style={{ display: rightTab === "quiz" ? undefined : "none" }}
    >
      <div className={`quiz-db-status ${online ? "ok" : "off"}`}>
        <Database size={13} />
        <span>
          {online === null
            ? "Conectando con la base de datos…"
            : online
            ? `Base de datos conectada · ${quizzes.length} cuestionarios`
            : "Sin servidor: cuestionarios incluidos (los resultados no se guardan)"}
        </span>
      </div>

      {online && !user && (
        <div className="quiz-login-hint">
          <span>Inicia sesión para guardar tus resultados y generar cuestionarios.</span>
          <button className="btn-xs" onClick={() => openModal("login")}>
            <LogIn size={13} /> Entrar
          </button>
        </div>
      )}

      {online && user && (
        <div className="quiz-toolbar">
          <button className="btn-xs" onClick={() => setEditor({ kind: "generate" })}>
            <Sparkles size={13} /> Generar
          </button>
          {hasRole(user, "docente") && (
            <button className="btn-xs" onClick={() => setEditor({ kind: "create" })}>
              <Plus size={13} /> Nuevo
            </button>
          )}
        </div>
      )}

      <div className="tour-selector quiz-list">
        {(compact && !listOpen && activeQuiz ? [activeQuiz] : quizzes).map((qz) => (
          <div
            key={qz.id}
            className={`tour-select-card ${activeQuiz?.id === qz.id ? "active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => choose(qz)}
            onKeyDown={(e) => {
              if (e.key === "Enter") choose(qz);
            }}
          >
            <div className="tour-select-title">
              <Award size={14} />
              <strong>{qz.title}</strong>
            </div>
            <small>{qz.subtitle}</small>
            {online && (
              <div className="quiz-card-actions">
                <span className="quiz-source-badge">
                  {qz.isPublic ? <Globe size={11} /> : <Lock size={11} />}{" "}
                  {qz.isPublic ? "Público" : "Privado"} · {SOURCE_LABEL[qz.source || "seed"]}
                  {qz.ownerName ? ` · de ${qz.ownerName}` : ""} · {qz.questions.length} preguntas
                </span>
                {qz.permissions?.results && (
                  <button
                    className="icon-btn"
                    title="Resultados de los alumnos"
                    onClick={(e) => {
                      e.stopPropagation();
                      setResultsFor(qz);
                    }}
                  >
                    <BarChart3 size={13} />
                  </button>
                )}
                {qz.permissions?.publish && (
                  <button
                    className="icon-btn"
                    title={qz.isPublic ? "Ocultar (hacer privado)" : "Publicar para todos"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(qz);
                    }}
                  >
                    {qz.isPublic ? <Lock size={13} /> : <Globe size={13} />}
                  </button>
                )}
                {qz.permissions?.edit && (
                  <button
                    className="icon-btn"
                    title="Editar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditor({ kind: "edit", quiz: qz });
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                )}
                {qz.permissions?.delete && (
                  <button
                    className="icon-btn"
                    title="Borrar"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(qz);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {compact && quizzes.length > 1 && (
          <button className="btn-xs list-toggle" onClick={() => setListOpen((o) => !o)}>
            {listOpen ? "Ocultar la lista" : `Cambiar de cuestionario (${quizzes.length})`}
          </button>
        )}
      </div>

      {activeQuiz && currentQuestion && !finished && (
        <div className="quiz-card">
          <div className="tour-step-badge">
            <span>
              Pregunta {questionIdx + 1} / {total}
            </span>
            <span className="fma-id">
              Aciertos: {score} / {total}
            </span>
          </div>

          <span className="quiz-mode-pill">
            {currentQuestion.type === "find3d"
              ? "🎯 Haz clic directamente sobre la pieza en el visor 3D"
              : "📋 Identifica la estructura resaltada en el visor 3D"}
          </span>

          <h3 className="tour-step-title">{currentQuestion.prompt}</h3>

          {currentQuestion.type === "multipleChoice" && (
            <div className="quiz-options">
              {shuffledOptions.map((opt) => {
                const isCorrectOption = opt === currentQuestion.targetNameEs;
                let cls = "quiz-option-btn";
                if (currentAnswer) {
                  if (isCorrectOption) cls += " correct";
                  else if (currentAnswer.answer === opt) cls += " wrong";
                }
                return (
                  <button
                    key={opt}
                    className={cls}
                    disabled={Boolean(currentAnswer)}
                    onClick={() =>
                      recordAnswer(currentQuestion, {
                        correct: isCorrectOption,
                        answer: opt,
                        revealed: false,
                      })
                    }
                  >
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!currentAnswer && (
            <div className="quiz-hint-box">
              {currentQuestion.hint && (
                <button className="btn-xs" onClick={() => setShowHint((h) => !h)}>
                  <Lightbulb size={13} /> {showHint ? "Ocultar pista" : "Ver pista"}
                </button>
              )}
              {currentQuestion.type === "find3d" && (
                <button
                  className="btn-xs"
                  onClick={() => {
                    recordAnswer(currentQuestion, {
                      correct: false,
                      answer: null,
                      revealed: true,
                    });
                    selectStructure(currentQuestion.targetStructureId);
                  }}
                >
                  Mostrar respuesta en 3D
                </button>
              )}
              {showHint && <p className="hint-text">{currentQuestion.hint}</p>}
            </div>
          )}

          {currentAnswer && (
            <div ref={feedbackRef} className={`quiz-feedback ${currentAnswer.correct ? "ok" : "fail"}`}>
              <div className="quiz-feedback-header">
                {currentAnswer.correct ? (
                  <>
                    <CheckCircle2 size={16} />
                    <strong>¡Respuesta correcta!</strong>
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    <strong>
                      {currentAnswer.revealed ? "Respuesta revelada" : "Respuesta incorrecta"}
                    </strong>
                  </>
                )}
              </div>
              {!currentAnswer.correct && (
                <p>
                  {currentAnswer.answer && <>Elegiste «{currentAnswer.answer}». </>}
                  La respuesta correcta es <strong>{currentQuestion.targetNameEs}</strong>.
                </p>
              )}
              {currentQuestion.explanation && <p>{currentQuestion.explanation}</p>}
              <button
                className="btn-credits"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => {
                  setShowHint(false);
                  if (questionIdx + 1 < total) setQuestionIdx(questionIdx + 1);
                  else finishQuiz();
                }}
              >
                <span>
                  {questionIdx + 1 < total ? "Siguiente pregunta →" : "Ver calificación final"}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {activeQuiz && finished && (
        <div className="quiz-card">
          <div className="quiz-summary">
            <Award size={34} color="#38bdf8" />
            <h3>¡Cuestionario completado!</h3>
            <p className="quiz-final-score">
              Obtuviste <strong>{score}</strong> de <strong>{total}</strong> aciertos (
              {Math.round((score / total) * 100)} %)
            </p>
            {saveStatus && <small className="quiz-save-status">{saveStatus}</small>}
            <button className="btn-credits" onClick={() => startQuiz(activeQuiz)}>
              <RotateCcw size={14} />
              <span>Reintentar cuestionario</span>
            </button>
          </div>
        </div>
      )}

      {online && user && attempts.length > 0 && (
        <div className="quiz-history">
          <strong>Tu historial ({attempts.length})</strong>
          {bestAttempt && (
            <small>
              Mejor resultado: {bestAttempt.score}/{bestAttempt.total} (
              {Math.round((bestAttempt.score / bestAttempt.total) * 100)} %)
            </small>
          )}
          <ul>
            {attempts.slice(0, 5).map((a) => (
              <li key={a.id}>
                <span>{new Date(a.finishedAt).toLocaleString("es")}</span>
                <span>
                  {a.score}/{a.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultsFor && <QuizResultsModal quiz={resultsFor} onClose={() => setResultsFor(null)} />}

      {editor && (
        <QuizEditorModal
          mode={editor}
          catalogBySex={catalogBySex}
          onClose={() => setEditor(null)}
          onSaved={async (quiz) => {
            setEditor(null);
            await reload(quiz.id);
            startQuiz(quiz);
          }}
        />
      )}
    </div>
  );
}

