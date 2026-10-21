import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Crosshair,
  EyeOff,
  RotateCcw,
  BookOpen,
  ExternalLink,
  Compass,
  HelpCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Play,
  Award,
} from "lucide-react";
import {
  AnatomyStructure,
  HubmapOrgan,
  SYSTEM_META,
} from "../data/types";
import { ANATOMY_QUIZZES, ANATOMY_TOURS } from "../data/didacticData";
import { useViewerStore } from "../store/useViewerStore";

export function InfoPanel({
  structures,
  structureById,
  hubmapById,
}: {
  structures: AnatomyStructure[];
  structureById: Map<string, AnatomyStructure>;
  hubmapById: Map<string, HubmapOrgan>;
}) {
  const mode = useViewerStore((s) => s.mode);
  const rightTab = useViewerStore((s) => s.rightTab);
  const activeHubmapOrganId = useViewerStore((s) => s.activeHubmapOrganId);
  const selectedId = useViewerStore((s) => s.selectedId);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const isolatedId = useViewerStore((s) => s.isolatedId);
  const hiddenIds = useViewerStore((s) => s.hiddenIds);
  const searchQuery = useViewerStore((s) => s.searchQuery);

  const setRightTab = useViewerStore((s) => s.setRightTab);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const setLayerEnabled = useViewerStore((s) => s.setLayerEnabled);
  const toggleIsolate = useViewerStore((s) => s.toggleIsolate);
  const toggleHide = useViewerStore((s) => s.toggleHide);
  const resetVisibility = useViewerStore((s) => s.resetVisibility);
  const setSearchQuery = useViewerStore((s) => s.setSearchQuery);
  const applySceneConfig = useViewerStore((s) => s.applySceneConfig);
  const setQuizClickHandler = useViewerStore((s) => s.setQuizClickHandler);

  // Estado local de Tours
  const [activeTourId, setActiveTourId] = useState<string>(ANATOMY_TOURS[0].id);
  const [tourStepIdx, setTourStepIdx] = useState<number>(0);

  // Estado local de Quiz
  const [activeQuizId, setActiveQuizId] = useState<string>(
    ANATOMY_QUIZZES[0].id
  );
  const [quizQuestionIdx, setQuizQuestionIdx] = useState<number>(0);
  const [quizScore, setQuizScore] = useState<number>(0);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
    selectedAnswer?: string;
  } | null>(null);

  const activeTour =
    ANATOMY_TOURS.find((t) => t.id === activeTourId) || ANATOMY_TOURS[0];
  const currentTourStep = activeTour.steps[tourStepIdx] || activeTour.steps[0];

  const activeQuiz =
    ANATOMY_QUIZZES.find((q) => q.id === activeQuizId) || ANATOMY_QUIZZES[0];
  const currentQuestion =
    activeQuiz.questions[quizQuestionIdx] || activeQuiz.questions[0];

  // Aplicar paso del tour en la escena 3D
  const launchTourStep = (tourId: string, stepIndex: number) => {
    const tour = ANATOMY_TOURS.find((t) => t.id === tourId);
    if (!tour) return;
    const step = tour.steps[stepIndex];
    if (!step) return;
    setActiveTourId(tourId);
    setTourStepIdx(stepIndex);
    applySceneConfig({
      bodySex: step.bodySex,
      enabledSystems: step.enabledSystems,
      systemOpacities: step.systemOpacities,
      selectedId: step.structureId,
      cameraPreset: step.cameraPreset,
      isolate: step.isolate,
    });
  };

  // Preparar la escena para la pregunta actual del quiz
  const prepareQuizQuestion = (quizId: string, qIndex: number) => {
    const qz = ANATOMY_QUIZZES.find((q) => q.id === quizId);
    if (!qz) return;
    const q = qz.questions[qIndex];
    if (!q) return;
    setFeedback(null);
    setShowHint(false);
    applySceneConfig({
      bodySex: q.bodySex,
      enabledSystems: q.enabledSystems,
      // En multipleChoice resaltamos la estructura objetivo para preguntar "¿Cuál es?";
      // en find3d dejamos selectedId en null para que el usuario la busque y haga clic.
      selectedId: q.type === "multipleChoice" ? q.targetStructureId : null,
      cameraPreset: "front",
      isolate: false,
    });
  };

  // Registrar o limpiar el listener de clics 3D cuando estamos en la pestaña Quiz
  useEffect(() => {
    if (
      rightTab === "quiz" &&
      !quizFinished &&
      currentQuestion?.type === "find3d" &&
      !feedback
    ) {
      setQuizClickHandler((clickedId: string) => {
        const isCorrect = clickedId === currentQuestion.targetStructureId;
        const clickedSt = structureById.get(clickedId);
        const clickedName = clickedSt ? clickedSt.nameEs : clickedId;
        if (isCorrect) {
          setQuizScore((s) => s + 1);
          setFeedback({
            correct: true,
            message: currentQuestion.explanation,
            selectedAnswer: clickedName,
          });
        } else {
          setFeedback({
            correct: false,
            message: `Seleccionaste "${clickedName}" (${clickedId}). La respuesta correcta era ${currentQuestion.targetNameEs} (${currentQuestion.targetStructureId}). ${currentQuestion.explanation}`,
            selectedAnswer: clickedName,
          });
        }
      });
    } else {
      setQuizClickHandler(null);
    }
    return () => setQuizClickHandler(null);
  }, [
    rightTab,
    quizFinished,
    currentQuestion,
    feedback,
    structureById,
    setQuizClickHandler,
  ]);

  const selectedStructure = selectedId ? structureById.get(selectedId) : null;
  const hoveredStructure = hoveredId ? structureById.get(hoveredId) : null;
  const parentStructure = selectedStructure?.parentId
    ? structureById.get(selectedStructure.parentId)
    : null;

  const activeHubmap = activeHubmapOrganId
    ? hubmapById.get(activeHubmapOrganId)
    : null;

  const filteredStructures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return structures
      .filter(
        (s) =>
          s.nameEs.toLowerCase().includes(q) ||
          s.nameLa.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [structures, searchQuery]);

  const hiddenCount = Object.keys(hiddenIds).length;

  return (
    <aside className="panel panel-right">
      {/* Pestañas superiores del panel derecho: Ficha | Tours | Quiz */}
      <div className="mode-tabs mode-tabs-3">
        <button
          className={`mode-tab ${rightTab === "info" ? "active" : ""}`}
          onClick={() => setRightTab("info")}
        >
          <FileText size={14} />
          <span>Ficha</span>
        </button>
        <button
          className={`mode-tab ${rightTab === "tours" ? "active" : ""}`}
          onClick={() => {
            setRightTab("tours");
            launchTourStep(activeTourId, tourStepIdx);
          }}
        >
          <Compass size={14} />
          <span>Tours ({ANATOMY_TOURS.length})</span>
        </button>
        <button
          className={`mode-tab ${rightTab === "quiz" ? "active" : ""}`}
          onClick={() => {
            setRightTab("quiz");
            prepareQuizQuestion(activeQuizId, quizQuestionIdx);
          }}
        >
          <HelpCircle size={14} />
          <span>Quiz ({ANATOMY_QUIZZES.length})</span>
        </button>
      </div>

      {/* PESTAÑA 1: FICHA ANATÓMICA Y BUSCADOR */}
      {rightTab === "info" && (
        <>
          {mode !== "hubmap" && (
            <div className="search-box">
              <div className="search-input-wrap">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar hueso, músculo, arteria, FMA…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="clear-btn"
                    onClick={() => setSearchQuery("")}
                    title="Limpiar búsqueda"
                  >
                    ×
                  </button>
                )}
              </div>

              {filteredStructures.length > 0 && (
                <div className="search-results">
                  {filteredStructures.map((st) => (
                    <button
                      key={st.id}
                      className={`search-result-item ${
                        selectedId === st.id ? "selected" : ""
                      }`}
                      onClick={() => {
                        setLayerEnabled(st.system, true);
                        selectStructure(st.id);
                        setSearchQuery("");
                      }}
                    >
                      <span
                        className="color-dot"
                        style={{
                          backgroundColor: SYSTEM_META[st.system].colorHex,
                        }}
                      />
                      <div className="search-result-text">
                        <strong>{st.nameEs}</strong>
                        <small>
                          {st.nameLa} · {st.id}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(isolatedId || hiddenCount > 0) && (
            <div className="visibility-banner">
              <span>
                {isolatedId ? "1 estructura aislada" : ""}
                {isolatedId && hiddenCount > 0 ? " · " : ""}
                {hiddenCount > 0 ? `${hiddenCount} ocultas` : ""}
              </span>
              <button className="btn-xs" onClick={resetVisibility}>
                <RotateCcw size={13} /> Restablecer
              </button>
            </div>
          )}

          {hoveredStructure && !selectedStructure && (
            <div className="hover-preview">
              <span className="hover-badge">Apuntando</span>
              <strong>{hoveredStructure.nameEs}</strong>
              <small>
                {hoveredStructure.nameLa} ({hoveredStructure.id})
              </small>
            </div>
          )}

          {mode !== "hubmap" ? (
            selectedStructure ? (
              <div className="structure-card">
                <div className="structure-header">
                  <span
                    className="system-pill"
                    style={{
                      borderColor:
                        SYSTEM_META[selectedStructure.system].colorHex,
                    }}
                  >
                    <span
                      className="color-dot"
                      style={{
                        backgroundColor:
                          SYSTEM_META[selectedStructure.system].colorHex,
                      }}
                    />
                    {SYSTEM_META[selectedStructure.system].labelEs}
                  </span>
                  <span className="fma-id">{selectedStructure.id}</span>
                </div>

                <h2 className="structure-title">{selectedStructure.nameEs}</h2>

                {selectedStructure.descriptionEs && (
                  <p className="structure-description">
                    {selectedStructure.descriptionEs}
                  </p>
                )}

                <dl className="meta-grid">
                  <div>
                    <dt>Latín (TA2)</dt>
                    <dd>{selectedStructure.nameLa}</dd>
                  </div>
                  <div>
                    <dt>Término técnico internacional (FMA/UBERON)</dt>
                    <dd>
                      {selectedStructure.nameEn}{" "}
                      {selectedStructure.ontologyId
                        ? `(${selectedStructure.ontologyId})`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Lateralidad</dt>
                    <dd>
                      {selectedStructure.side === "left"
                        ? "Izquierda (sinister)"
                        : selectedStructure.side === "right"
                        ? "Derecha (dexter)"
                        : "Mediana / impar"}
                    </dd>
                  </div>
                  {selectedStructure.parentId && (
                    <div>
                      <dt>Estructura padre</dt>
                      <dd>
                        {parentStructure ? (
                          <button
                            className="link-inline"
                            onClick={() => selectStructure(parentStructure.id)}
                          >
                            {parentStructure.nameEs} ({parentStructure.id})
                          </button>
                        ) : (
                          selectedStructure.parentId
                        )}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="action-buttons">
                  <button
                    className={`btn-action ${
                      isolatedId === selectedStructure.id ? "active" : ""
                    }`}
                    onClick={() => toggleIsolate(selectedStructure.id)}
                  >
                    <Crosshair size={15} />
                    <span>
                      {isolatedId === selectedStructure.id
                        ? "Salir de aislar"
                        : "Aislar (I)"}
                    </span>
                  </button>
                  <button
                    className={`btn-action ${
                      hiddenIds[selectedStructure.id] ? "active" : ""
                    }`}
                    onClick={() => toggleHide(selectedStructure.id)}
                  >
                    <EyeOff size={15} />
                    <span>
                      {hiddenIds[selectedStructure.id]
                        ? "Mostrar (H)"
                        : "Ocultar (H)"}
                    </span>
                  </button>
                  <button className="btn-action" onClick={resetVisibility}>
                    <RotateCcw size={15} />
                    <span>Restablecer (R)</span>
                  </button>
                </div>

                <div className="attribution-mini">
                  <BookOpen size={14} />
                  <div>
                    {selectedStructure.source === "hubmap" ? (
                      <>
                        <strong>Fuente 3D:</strong> HuBMAP CCF 3D Reference
                        Object Library (Visible Human Female) ·{" "}
                        <a
                          href="https://creativecommons.org/licenses/by/4.0/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          CC BY 4.0 <ExternalLink size={11} />
                        </a>
                      </>
                    ) : (
                      <>
                        <strong>Fuente 3D:</strong> BodyParts3D v4.0 (© The
                        Database Center for Life Science) ·{" "}
                        <a
                          href="https://creativecommons.org/licenses/by/4.0/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          CC BY 4.0 <ExternalLink size={11} />
                        </a>
                        <br />
                        <small>
                          Mallas elementales:{" "}
                          {selectedStructure.elementFiles?.join(", ") || "N/D"}
                        </small>
                      </>
                    )}
                    {selectedStructure.descriptionSource && (
                      <small style={{ display: "block", marginTop: 3 }}>
                        <strong>Texto didáctico:</strong>{" "}
                        {selectedStructure.descriptionSource}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <h3>Selecciona una estructura 3D</h3>
                <p>
                  Haz clic sobre cualquier hueso, músculo, vaso sanguíneo u
                  órgano en el visor para inspeccionar su ficha anatómica
                  completa en español.
                </p>
                <ul className="tips-list">
                  <li>
                    <strong>Clic izquierdo + arrastrar:</strong> rotar cámara
                  </li>
                  <li>
                    <strong>Rueda del ratón:</strong> acercar / alejar (zoom)
                  </li>
                  <li>
                    <strong>Atajos de teclado:</strong> <code>I</code> aislar ·{" "}
                    <code>H</code> ocultar · <code>L</code> pines 3D ·{" "}
                    <code>R</code> restablecer
                  </li>
                </ul>
              </div>
            )
          ) : activeHubmap ? (
            <div className="structure-card">
              <div className="structure-header">
                <span className="system-pill">
                  {SYSTEM_META[activeHubmap.system]?.labelEs ||
                    activeHubmap.system}
                </span>
                <span className="fma-id">{activeHubmap.version}</span>
              </div>
              <h2 className="structure-title">
                {activeHubmap.nameEs || activeHubmap.organ}
              </h2>
              <p className="hubmap-meta-line">
                Sexo:{" "}
                <strong>
                  {activeHubmap.sex === "female"
                    ? "Femenino (♀)"
                    : activeHubmap.sex === "male"
                    ? "Masculino (♂)"
                    : "No especificado"}
                </strong>{" "}
                · Subestructura:{" "}
                <strong>
                  {activeHubmap.nodes.find((n) => n.nodeName === selectedId)
                    ?.nameEs ||
                    selectedId ||
                    "ninguna"}
                </strong>
              </p>
              {selectedId &&
                activeHubmap.nodes.find((n) => n.nodeName === selectedId)
                  ?.descriptionEs && (
                  <p className="structure-description">
                    {
                      activeHubmap.nodes.find((n) => n.nodeName === selectedId)
                        ?.descriptionEs
                    }
                  </p>
                )}

              <div className="nodes-sublist">
                <h4>Subestructuras mapeadas ({activeHubmap.nodes.length})</h4>
                <div className="nodes-scroll">
                  {activeHubmap.nodes.map((n, i) => (
                    <button
                      key={`${n.nodeName}-${i}`}
                      className={`node-row ${
                        selectedId === n.nodeName ? "active" : ""
                      }`}
                      onClick={() => selectStructure(n.nodeName)}
                    >
                      <div>
                        <strong>{n.nameEs}</strong>
                        <small>{n.nodeName}</small>
                      </div>
                      <span className="ont-tag">{n.ontologyId}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="attribution-mini">
                <BookOpen size={14} />
                <div>
                  <strong>Fuente:</strong> HuBMAP CCF 3D Reference Object
                  Library ·{" "}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CC BY 4.0 <ExternalLink size={11} />
                  </a>
                  <p className="citation-text">{activeHubmap.citation}</p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* PESTAÑA 2: TOURS GUIADOS */}
      {rightTab === "tours" && (
        <div className="didactic-section">
          <div className="tour-selector">
            {ANATOMY_TOURS.map((tour) => (
              <button
                key={tour.id}
                className={`tour-select-card ${
                  activeTour.id === tour.id ? "active" : ""
                }`}
                onClick={() => launchTourStep(tour.id, 0)}
              >
                <div className="tour-select-title">
                  <Play size={13} />
                  <strong>{tour.title}</strong>
                </div>
                <small>{tour.subtitle}</small>
              </button>
            ))}
          </div>

          <div className="tour-player-card">
            <div className="tour-step-badge">
              <span>
                Paso {tourStepIdx + 1} de {activeTour.steps.length}
              </span>
              <span className="fma-id">{currentTourStep.structureId}</span>
            </div>

            <h3 className="tour-step-title">{currentTourStep.title}</h3>
            <p className="structure-description">
              {currentTourStep.description}
            </p>

            <div className="tour-dots">
              {activeTour.steps.map((st, idx) => (
                <button
                  key={st.structureId + idx}
                  className={`tour-dot ${idx === tourStepIdx ? "active" : ""}`}
                  onClick={() => launchTourStep(activeTour.id, idx)}
                  title={`Ir al paso ${idx + 1}: ${st.title}`}
                />
              ))}
            </div>

            <div className="tour-nav-btns">
              <button
                className="btn-action"
                disabled={tourStepIdx === 0}
                onClick={() =>
                  launchTourStep(activeTour.id, Math.max(0, tourStepIdx - 1))
                }
              >
                <ChevronLeft size={15} />
                <span>Anterior</span>
              </button>
              <button
                className="btn-action"
                onClick={() => setRightTab("info")}
                title="Ver ficha completa de esta estructura"
              >
                <FileText size={15} />
                <span>Ver Ficha</span>
              </button>
              <button
                className="btn-action"
                disabled={tourStepIdx >= activeTour.steps.length - 1}
                onClick={() =>
                  launchTourStep(
                    activeTour.id,
                    Math.min(activeTour.steps.length - 1, tourStepIdx + 1)
                  )
                }
              >
                <ChevronRight size={15} />
                <span>Siguiente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: MODO QUIZ (CUESTIONARIOS) */}
      {rightTab === "quiz" && (
        <div className="didactic-section">
          <div className="tour-selector">
            {ANATOMY_QUIZZES.map((qz) => (
              <button
                key={qz.id}
                className={`tour-select-card ${
                  activeQuiz.id === qz.id ? "active" : ""
                }`}
                onClick={() => {
                  setActiveQuizId(qz.id);
                  setQuizQuestionIdx(0);
                  setQuizScore(0);
                  setQuizFinished(false);
                  prepareQuizQuestion(qz.id, 0);
                }}
              >
                <div className="tour-select-title">
                  <Award size={14} />
                  <strong>{qz.title}</strong>
                </div>
                <small>{qz.subtitle}</small>
              </button>
            ))}
          </div>

          {!quizFinished ? (
            <div className="quiz-card">
              <div className="tour-step-badge">
                <span>
                  Pregunta {quizQuestionIdx + 1} / {activeQuiz.questions.length}
                </span>
                <span className="fma-id">
                  Aciertos: {quizScore} / {activeQuiz.questions.length}
                </span>
              </div>

              <span className="quiz-mode-pill">
                {currentQuestion.type === "find3d"
                  ? "🎯 Haz clic directamente sobre la pieza en el visor 3D"
                  : "📋 Identifica la estructura resaltada en el visor 3D"}
              </span>

              <h3 className="tour-step-title">{currentQuestion.prompt}</h3>

              {currentQuestion.type === "multipleChoice" &&
                currentQuestion.options && (
                  <div className="quiz-options">
                    {currentQuestion.options.map((opt) => {
                      const isCorrectOption =
                        opt === currentQuestion.targetNameEs;
                      const isPicked = feedback?.selectedAnswer === opt;
                      let cls = "quiz-option-btn";
                      if (feedback) {
                        if (isCorrectOption) cls += " correct";
                        else if (isPicked) cls += " wrong";
                      }
                      return (
                        <button
                          key={opt}
                          className={cls}
                          disabled={Boolean(feedback)}
                          onClick={() => {
                            const ok = opt === currentQuestion.targetNameEs;
                            if (ok) setQuizScore((s) => s + 1);
                            setFeedback({
                              correct: ok,
                              selectedAnswer: opt,
                              message: currentQuestion.explanation,
                            });
                          }}
                        >
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

              {!feedback && (
                <div className="quiz-hint-box">
                  <button
                    className="btn-xs"
                    onClick={() => setShowHint((h) => !h)}
                  >
                    <Lightbulb size={13} />{" "}
                    {showHint ? "Ocultar pista" : "Ver pista"}
                  </button>
                  {currentQuestion.type === "find3d" && (
                    <button
                      className="btn-xs"
                      onClick={() => {
                        selectStructure(currentQuestion.targetStructureId);
                        setFeedback({
                          correct: false,
                          message: `Estructura revelada: ${currentQuestion.targetNameEs} (${currentQuestion.targetStructureId}). ${currentQuestion.explanation}`,
                        });
                      }}
                    >
                      Mostrar respuesta en 3D
                    </button>
                  )}
                  {showHint && (
                    <p className="hint-text">{currentQuestion.hint}</p>
                  )}
                </div>
              )}

              {feedback && (
                <div
                  className={`quiz-feedback ${
                    feedback.correct ? "ok" : "fail"
                  }`}
                >
                  <div className="quiz-feedback-header">
                    {feedback.correct ? (
                      <>
                        <CheckCircle2 size={16} />
                        <strong>¡Respuesta correcta!</strong>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        <strong>Respuesta incorrecta</strong>
                      </>
                    )}
                  </div>
                  <p>{feedback.message}</p>
                  <button
                    className="btn-credits"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      if (quizQuestionIdx + 1 < activeQuiz.questions.length) {
                        const next = quizQuestionIdx + 1;
                        setQuizQuestionIdx(next);
                        prepareQuizQuestion(activeQuiz.id, next);
                      } else {
                        setQuizFinished(true);
                      }
                    }}
                  >
                    <span>
                      {quizQuestionIdx + 1 < activeQuiz.questions.length
                        ? "Siguiente pregunta →"
                        : "Ver calificación final"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="quiz-card">
              <div className="quiz-summary">
                <Award size={34} color="#38bdf8" />
                <h3>¡Cuestionario completado!</h3>
                <p className="quiz-final-score">
                  Obtuviste <strong>{quizScore}</strong> de{" "}
                  <strong>{activeQuiz.questions.length}</strong> aciertos (
                  {Math.round((quizScore / activeQuiz.questions.length) * 100)}
                  %)
                </p>
                <button
                  className="btn-credits"
                  onClick={() => {
                    setQuizQuestionIdx(0);
                    setQuizScore(0);
                    setQuizFinished(false);
                    prepareQuizQuestion(activeQuiz.id, 0);
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Reintentar cuestionario</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
