import React, { useEffect, useState } from "react";
import { ApiError } from "../data/api";
import { AnatomyQuiz } from "../data/didacticData";
import { getQuizResults, QuizResults } from "../data/libraryApi";
import { Modal } from "./Modal";

const pct = (ratio: number | null) => (ratio === null ? "—" : `${Math.round(ratio * 100)} %`);

// Barra de porcentaje accesible: el número va siempre en texto; la barra solo acompaña.
function Meter({ ratio }: { ratio: number }) {
  const level = ratio >= 0.7 ? "good" : ratio >= 0.4 ? "mid" : "low";
  return (
    <span className="results-meter" aria-hidden="true">
      <span className={`results-meter-fill ${level}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
    </span>
  );
}

export function QuizResultsModal({ quiz, onClose }: { quiz: AnatomyQuiz; onClose: () => void }) {
  const [results, setResults] = useState<QuizResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQuizResults(quiz.id)
      .then(setResults)
      .catch((err) => setError((err as ApiError).message));
  }, [quiz.id]);

  return (
    <Modal title={`Resultados · ${quiz.title}`} onClose={onClose} width={900}>
      {error && <div className="editor-error">{error}</div>}
      {!results && !error && <p>Cargando…</p>}
      {results && results.attemptCount === 0 && (
        <p>
          Todavía nadie ha terminado este cuestionario con la sesión iniciada.
          {!quiz.isPublic && " Es privado: publícalo para que tus alumnos puedan hacerlo."}
        </p>
      )}

      {results && results.attemptCount > 0 && (
        <>
          <div className="results-kpis">
            <div>
              <strong>{results.studentCount}</strong>
              <small>alumnos</small>
            </div>
            <div>
              <strong>{results.attemptCount}</strong>
              <small>intentos</small>
            </div>
            <div>
              <strong>{pct(results.avgRatio)}</strong>
              <small>media de aciertos</small>
            </div>
          </div>

          <div className="account-section">
            <h3>Por alumno</h3>
            <div className="account-table-wrap">
              <table className="account-table cards">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Intentos</th>
                    <th>Mejor</th>
                    <th>Último</th>
                    <th>Media</th>
                    <th>Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {results.students.map((s) => (
                    <tr key={s.userId}>
                      <td data-label="Alumno">{s.username}</td>
                      <td data-label="Intentos">{s.attempts}</td>
                      <td data-label="Mejor">
                        {s.bestScore}/{s.total}
                      </td>
                      <td data-label="Último">
                        {s.lastScore}/{s.total}
                      </td>
                      <td data-label="Media">
                        <Meter ratio={s.avgRatio} /> {pct(s.avgRatio)}
                      </td>
                      <td data-label="Última vez">{new Date(s.lastAt).toLocaleString("es")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="account-section">
            <h3>Por pregunta</h3>
            <p className="account-note">
              Las preguntas con menos aciertos son las que conviene repasar en clase.
            </p>
            <div className="account-table-wrap">
              <table className="account-table cards results-questions">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Pregunta</th>
                    <th>Aciertos</th>
                    <th>Reveladas</th>
                    <th>Errores más comunes</th>
                  </tr>
                </thead>
                <tbody>
                  {results.questions.map((q, i) => {
                    const ratio = q.answered ? q.correct / q.answered : 0;
                    return (
                      <tr key={q.questionId}>
                        <td data-label="#">{i + 1}</td>
                        <td data-label="Pregunta" className="results-prompt">
                          {q.prompt}
                          <small>Respuesta: {q.targetNameEs}</small>
                        </td>
                        <td data-label="Aciertos">
                          {q.answered ? (
                            <>
                              <Meter ratio={ratio} /> {pct(ratio)} ({q.correct}/{q.answered})
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td data-label="Reveladas">{q.revealed}</td>
                        <td data-label="Errores más comunes" className="results-prompt">
                          {q.topWrong.length
                            ? q.topWrong.map((w) => `${w.answer} (${w.count})`).join(" · ")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
