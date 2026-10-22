import React, { useEffect, useState } from "react";
import { KeyRound, NotebookPen, Trash2, UserCircle2 } from "lucide-react";
import { ApiError } from "../data/api";
import { changePassword, deleteAccount, listMyAttempts, ROLE_LABEL } from "../data/authApi";
import { QuizAttempt } from "../data/quizApi";
import { AnatomyStructure } from "../data/types";
import { BodySex, useViewerStore } from "../store/useViewerStore";
import { useAuthStore } from "../store/useAuthStore";
import { useNotesStore } from "../store/useNotesStore";
import { Modal } from "./Modal";

// Busca una estructura por id en los dos modelos (lo resuelve App con metadata.json).
export type LocateStructure = (id: string) => { structure: AnatomyStructure; bodySex: BodySex } | null;

function MyNotes({ locate }: { locate: LocateStructure }) {
  const notes = useNotesStore((s) => s.byId);
  const applySceneConfig = useViewerStore((s) => s.applySceneConfig);
  const setRightTab = useViewerStore((s) => s.setRightTab);
  const openModal = useAuthStore((s) => s.openModal);
  const list = Object.values(notes).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Lleva al visor: modelo y sistema de la estructura, seleccionada y con su ficha abierta.
  const goTo = (structureId: string) => {
    const found = locate(structureId);
    if (!found) return;
    applySceneConfig({
      bodySex: found.bodySex,
      enabledSystems: [found.structure.system],
      selectedId: structureId,
      cameraPreset: "front",
    });
    setRightTab("info");
    openModal(null);
  };

  return (
    <div className="account-section">
      <h3>
        <NotebookPen size={15} /> Mis notas ({list.length})
      </h3>
      {list.length === 0 ? (
        <p>Selecciona una estructura en el visor y escribe en «Mis notas» de su ficha.</p>
      ) : (
        <ul className="notes-list">
          {list.map((n) => {
            const found = locate(n.structureId);
            return (
              <li key={n.structureId}>
                <button className="views-open" onClick={() => goTo(n.structureId)} disabled={!found}>
                  <strong>{found?.structure.nameEs ?? n.structureId}</strong>
                  <small>{n.note.length > 140 ? `${n.note.slice(0, 140)}…` : n.note}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setStatus({ ok: false, text: "La nueva contraseña debe tener al menos 8 caracteres." });
    if (next !== repeat) return setStatus({ ok: false, text: "Las contraseñas nuevas no coinciden." });
    setBusy(true);
    try {
      await changePassword(current, next);
      setStatus({ ok: true, text: "Contraseña cambiada. Se cerraron tus otras sesiones." });
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (err) {
      setStatus({ ok: false, text: (err as ApiError).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="account-section" onSubmit={submit}>
      <h3>
        <KeyRound size={15} /> Cambiar contraseña
      </h3>
      <div className="editor-grid">
        <label className="editor-field">
          <span>Actual</span>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="editor-field">
          <span>Nueva</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label className="editor-field">
          <span>Repite la nueva</span>
          <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
      </div>
      {status && <div className={status.ok ? "account-ok" : "editor-error"}>{status.text}</div>}
      <div className="editor-footer">
        <button className="btn-credits" type="submit" disabled={busy || !current}>
          Guardar contraseña
        </button>
      </div>
    </form>
  );
}

function DeleteAccount() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const openModal = useAuthStore((s) => s.openModal);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await deleteAccount(password);
      clearSession();
      openModal(null);
    } catch (err) {
      setError((err as ApiError).message);
    }
  };

  return (
    <div className="account-section account-danger">
      <h3>
        <Trash2 size={15} /> Borrar mi cuenta
      </h3>
      <p>
        Se borran tu usuario, tus cuestionarios y todo tu historial de resultados. No se puede deshacer.
      </p>
      {!open ? (
        <button className="btn-xs" onClick={() => setOpen(true)}>
          Quiero borrar mi cuenta
        </button>
      ) : (
        <form className="account-inline" onSubmit={submit}>
          <input
            type="password"
            placeholder="Confirma con tu contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn-danger" type="submit" disabled={!password}>
            Borrar definitivamente
          </button>
          <button className="btn-xs" type="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </form>
      )}
      {error && <div className="editor-error">{error}</div>}
    </div>
  );
}

export function ProfileModal({ locate }: { locate: LocateStructure }) {
  const user = useAuthStore((s) => s.user);
  const openModal = useAuthStore((s) => s.openModal);
  const [attempts, setAttempts] = useState<QuizAttempt[] | null>(null);

  useEffect(() => {
    listMyAttempts()
      .then(setAttempts)
      .catch(() => setAttempts([]));
  }, []);

  if (!user) return null;
  const avg =
    attempts && attempts.length
      ? Math.round((attempts.reduce((s, a) => s + a.score / a.total, 0) / attempts.length) * 100)
      : null;

  return (
    <Modal title="Mi perfil" onClose={() => openModal(null)} width={640}>
      <div className="profile-header">
        <UserCircle2 size={34} />
        <div>
          <strong>{user.username}</strong>
          <small>{ROLE_LABEL[user.role]}</small>
        </div>
      </div>

      <div className="account-section">
        <h3>Mi historial de cuestionarios</h3>
        {attempts === null ? (
          <p>Cargando…</p>
        ) : attempts.length === 0 ? (
          <p>Aún no has terminado ningún cuestionario con la sesión iniciada.</p>
        ) : (
          <>
            <p>
              {attempts.length} intentos · media de aciertos {avg} %
            </p>
            <table className="account-table cards">
              <thead>
                <tr>
                  <th>Cuestionario</th>
                  <th>Resultado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Cuestionario">{a.quizTitle}</td>
                    <td data-label="Resultado">
                      {a.score}/{a.total} ({Math.round((a.score / a.total) * 100)} %)
                    </td>
                    <td data-label="Fecha">{new Date(a.finishedAt).toLocaleString("es")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <MyNotes locate={locate} />
      <PasswordForm />
      <DeleteAccount />
    </Modal>
  );
}
