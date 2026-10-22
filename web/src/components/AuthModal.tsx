import React, { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { ApiError } from "../data/api";
import { useAuthStore } from "../store/useAuthStore";
import { Modal } from "./Modal";

const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;

export function AuthModal({ mode }: { mode: "login" | "register" }) {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const openModal = useAuthStore((s) => s.openModal);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";

  const validate = (): string | null => {
    if (!USERNAME_RE.test(username)) {
      return "El usuario debe tener de 3 a 32 caracteres: letras, números, punto, guion o guion bajo.";
    }
    if (isRegister && password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (isRegister && password !== repeat) return "Las contraseñas no coinciden.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      await (isRegister ? register : login)(username, password);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (next: "login" | "register") => {
    setError(null);
    setPassword("");
    setRepeat("");
    openModal(next);
  };

  return (
    <Modal title={isRegister ? "Crear cuenta" : "Iniciar sesión"} onClose={() => openModal(null)} width={420}>
      <div className="mode-tabs auth-tabs">
        <button className={`mode-tab ${!isRegister ? "active" : ""}`} onClick={() => switchTo("login")}>
          <LogIn size={14} /> <span>Iniciar sesión</span>
        </button>
        <button className={`mode-tab ${isRegister ? "active" : ""}`} onClick={() => switchTo("register")}>
          <UserPlus size={14} /> <span>Crear cuenta</span>
        </button>
      </div>

      <form className="account-form" onSubmit={submit}>
        <label className="editor-field">
          <span>Usuario</span>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
          />
        </label>
        <label className="editor-field">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {isRegister && (
          <label className="editor-field">
            <span>Repite la contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </label>
        )}

        {error && <div className="editor-error">{error}</div>}

        <button className="btn-credits account-submit" type="submit" disabled={busy}>
          {busy ? "Un momento…" : isRegister ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <p className="account-note">
        {isRegister
          ? "Las cuentas nuevas son de estudiante: guardan su historial y pueden generar cuestionarios privados. Un administrador puede darte el rol de docente."
          : "¿Olvidaste la contraseña? Pide a un administrador que la restablezca."}{" "}
        No pedimos correo ni otros datos personales.{" "}
        <button className="link-inline" onClick={() => openModal("privacy")}>
          Ver privacidad
        </button>
      </p>
    </Modal>
  );
}
