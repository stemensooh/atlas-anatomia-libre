import React, { useCallback, useEffect, useState } from "react";
import { Check, Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import { ApiError } from "../data/api";
import { createView, deleteView, listViews, SavedView, updateView } from "../data/libraryApi";
import { captureViewState, parseViewState } from "../data/viewState";
import { useAuthStore } from "../store/useAuthStore";
import { useViewerStore } from "../store/useViewerStore";
import { Modal } from "./Modal";

const SEX_LABEL = { male: "Masculino", female: "Femenino" } as const;

// Resumen corto de lo que contiene una vista, para reconocerla en la lista.
function describe(view: SavedView): string {
  const v = parseViewState(view.state);
  if (!v) return "Formato no reconocido";
  const systems = Object.values(v.layers).filter((l) => l?.enabled).length;
  const parts = [SEX_LABEL[v.bodySex], `${systems} sistemas`];
  if (v.mode === "hubmap") parts.push("órgano HuBMAP");
  if (v.selectedId) parts.push("con selección");
  if (v.clip.axialY !== null || v.clip.sagittalX !== null || v.clip.coronalZ !== null) parts.push("con cortes");
  return parts.join(" · ");
}

export function ViewsModal() {
  const openModal = useAuthStore((s) => s.openModal);
  const applySavedView = useViewerStore((s) => s.applySavedView);

  const [views, setViews] = useState<SavedView[] | null>(null);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      setViews(await listViews());
    } catch (err) {
      setMessage({ ok: false, text: (err as ApiError).message });
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = async (action: () => Promise<unknown>, okText: string) => {
    try {
      await action();
      setMessage({ ok: true, text: okText });
      await reload();
    } catch (err) {
      setMessage({ ok: false, text: (err as ApiError).message });
    }
  };

  const open = (view: SavedView) => {
    const state = parseViewState(view.state);
    if (!state) return setMessage({ ok: false, text: "No se puede abrir esta vista." });
    applySavedView(state);
    openModal(null);
  };

  return (
    <Modal title="Mis vistas" onClose={() => openModal(null)} width={620}>
      <form
        className="account-inline"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          run(async () => {
            await createView(trimmed, captureViewState());
            setName("");
          }, `Vista «${trimmed}» guardada.`);
        }}
      >
        <input
          type="text"
          maxLength={80}
          placeholder="Nombre de la vista actual (p. ej. «Corazón sin costillas»)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-credits" type="submit" disabled={!name.trim()}>
          <Save size={14} /> Guardar vista actual
        </button>
      </form>
      <p className="account-note">
        Se guardan la cámara, el modelo, los sistemas visibles y su opacidad, la estructura
        seleccionada, lo aislado u oculto, los cortes y los pines. Solo tú ves tus vistas.
      </p>

      {message && <div className={message.ok ? "account-ok" : "editor-error"}>{message.text}</div>}

      {views === null ? (
        <p>Cargando…</p>
      ) : views.length === 0 ? (
        <p>Aún no has guardado ninguna vista.</p>
      ) : (
        <ul className="views-list">
          {views.map((v) => (
            <li key={v.id}>
              {renaming?.id === v.id ? (
                <form
                  className="account-inline views-rename"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = renaming.name.trim();
                    if (!trimmed) return;
                    run(async () => {
                      await updateView(v.id, { name: trimmed });
                      setRenaming(null);
                    }, "Vista renombrada.");
                  }}
                >
                  <input
                    type="text"
                    autoFocus
                    maxLength={80}
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: v.id, name: e.target.value })}
                  />
                  <button className="icon-btn" type="submit" title="Guardar nombre">
                    <Check size={14} />
                  </button>
                </form>
              ) : (
                <button className="views-open" onClick={() => open(v)} title="Abrir esta vista">
                  <strong>{v.name}</strong>
                  <small>
                    {describe(v)} · {new Date(v.updatedAt).toLocaleString("es")}
                  </small>
                </button>
              )}
              <div className="admin-actions">
                <button
                  className="icon-btn"
                  title="Renombrar"
                  onClick={() => setRenaming({ id: v.id, name: v.name })}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-btn"
                  title="Sobrescribir con la escena actual"
                  onClick={() => {
                    if (window.confirm(`¿Sustituir «${v.name}» por lo que se ve ahora?`)) {
                      run(() => updateView(v.id, { state: captureViewState() }), `«${v.name}» actualizada.`);
                    }
                  }}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  className="icon-btn"
                  title="Borrar"
                  onClick={() => {
                    if (window.confirm(`¿Borrar la vista «${v.name}»?`)) {
                      run(() => deleteView(v.id), `«${v.name}» borrada.`);
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
