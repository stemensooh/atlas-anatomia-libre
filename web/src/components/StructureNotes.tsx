import React, { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import { ApiError } from "../data/api";
import { useAuthStore } from "../store/useAuthStore";
import { useNotesStore } from "../store/useNotesStore";

// Nota privada del usuario sobre la estructura seleccionada (en la Ficha).
export function StructureNotes({ structureId }: { structureId: string }) {
  const user = useAuthStore((s) => s.user);
  const serverOnline = useAuthStore((s) => s.serverOnline);
  const openModal = useAuthStore((s) => s.openModal);
  const saved = useNotesStore((s) => s.byId[structureId]);
  const save = useNotesStore((s) => s.save);

  const [text, setText] = useState(saved?.note ?? "");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Al cambiar de estructura (o cargarse las notas) se muestra la nota guardada.
  useEffect(() => {
    setText(saved?.note ?? "");
    setStatus(null);
  }, [structureId, saved?.note]);

  if (!serverOnline) return null;

  if (!user) {
    return (
      <div className="notes-box">
        <div className="notes-header">
          <NotebookPen size={14} /> <strong>Mis notas</strong>
        </div>
        <p className="notes-hint">
          <button className="link-inline" onClick={() => openModal("login")}>
            Inicia sesión
          </button>{" "}
          para escribir notas privadas sobre cada estructura.
        </p>
      </div>
    );
  }

  const dirty = text !== (saved?.note ?? "");

  const submit = async () => {
    setBusy(true);
    try {
      await save(structureId, text);
      setStatus({ ok: true, text: text.trim() ? "Nota guardada." : "Nota borrada." });
    } catch (err) {
      setStatus({ ok: false, text: (err as ApiError).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notes-box">
      <div className="notes-header">
        <NotebookPen size={14} /> <strong>Mis notas</strong>
        {saved && (
          <small>Actualizada el {new Date(saved.updatedAt).toLocaleDateString("es")}</small>
        )}
      </div>
      <textarea
        rows={3}
        maxLength={5000}
        placeholder="Escribe aquí lo que quieras recordar de esta estructura (solo tú la ves)."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus(null);
        }}
        onKeyDown={(e) => {
          // Ctrl/Cmd + Enter guarda.
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && dirty) submit();
        }}
      />
      <div className="notes-actions">
        {status && <small className={status.ok ? "notes-ok" : "notes-error"}>{status.text}</small>}
        <button className="btn-xs" disabled={!dirty || busy} onClick={submit}>
          {busy ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
    </div>
  );
}
