import React, { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { ApiError } from "../data/api";
import {
  AdminUser,
  adminDeleteUser,
  adminListUsers,
  adminResetPassword,
  adminUpdateUser,
  Role,
  ROLE_LABEL,
} from "../data/authApi";
import { useAuthStore } from "../store/useAuthStore";
import { Modal } from "./Modal";

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es") : "—");

export function AdminUsersModal() {
  const me = useAuthStore((s) => s.user);
  const openModal = useAuthStore((s) => s.openModal);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const reload = useCallback(async () => {
    try {
      setUsers(await adminListUsers());
    } catch (err) {
      setMessage({ ok: false, text: (err as ApiError).message });
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Ejecuta una acción, muestra el resultado y recarga la lista.
  const run = async (action: () => Promise<unknown>, okText: string) => {
    try {
      await action();
      setMessage({ ok: true, text: okText });
      await reload();
    } catch (err) {
      setMessage({ ok: false, text: (err as ApiError).message });
    }
  };

  const visible = (users ?? []).filter((u) => u.username.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Modal title="Administración de usuarios" onClose={() => openModal(null)} width={900}>
      <div className="admin-toolbar">
        <input
          type="text"
          className="admin-filter"
          placeholder="Filtrar por usuario…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <small>{users ? `${users.length} usuarios` : "Cargando…"}</small>
      </div>

      {message && <div className={message.ok ? "account-ok" : "editor-error"}>{message.text}</div>}

      <div className="account-table-wrap">
        <table className="account-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Activo</th>
              <th>Cuestionarios</th>
              <th>Intentos</th>
              <th>Alta</th>
              <th>Último acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <React.Fragment key={u.id}>
                  <tr className={u.isActive ? "" : "is-inactive"}>
                    <td>
                      <strong>{u.username}</strong>
                      {isMe && <small> (tú)</small>}
                    </td>
                    <td>
                      <select
                        value={u.role}
                        disabled={isMe}
                        title={isMe ? "No puedes cambiar tu propio rol" : undefined}
                        onChange={(e) =>
                          run(
                            () => adminUpdateUser(u.id, { role: e.target.value as Role }),
                            `${u.username} ahora es ${ROLE_LABEL[e.target.value as Role].toLowerCase()}.`
                          )
                        }
                      >
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={u.isActive}
                        disabled={isMe}
                        onChange={(e) =>
                          run(
                            () => adminUpdateUser(u.id, { isActive: e.target.checked }),
                            e.target.checked ? `${u.username} reactivado.` : `${u.username} desactivado y desconectado.`
                          )
                        }
                      />
                    </td>
                    <td>{u.quizCount}</td>
                    <td>{u.attemptCount}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{formatDate(u.lastLoginAt)}</td>
                    <td className="admin-actions">
                      <button
                        className="icon-btn"
                        title="Restablecer contraseña"
                        onClick={() => {
                          setResetFor(resetFor === u.id ? null : u.id);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        title={isMe ? "Para borrar tu cuenta usa Mi perfil" : "Borrar usuario y sus datos"}
                        disabled={isMe}
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Borrar a ${u.username}? Se borrarán también sus ${u.quizCount} cuestionarios y ${u.attemptCount} intentos.`
                            )
                          ) {
                            run(() => adminDeleteUser(u.id), `${u.username} borrado.`);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  {resetFor === u.id && (
                    <tr>
                      <td colSpan={8}>
                        <form
                          className="account-inline"
                          onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                              await adminResetPassword(u.id, newPassword);
                              setResetFor(null);
                            }, `Contraseña de ${u.username} restablecida. Comunícasela en persona; sus sesiones se cerraron.`);
                          }}
                        >
                          <input
                            type="text"
                            placeholder={`Nueva contraseña temporal para ${u.username} (mín. 8)`}
                            value={newPassword}
                            autoComplete="off"
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                          <button className="btn-credits" type="submit" disabled={newPassword.length < 8}>
                            Restablecer
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
