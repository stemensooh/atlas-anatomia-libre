import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Ventana modal común (mismo estilo que Créditos). Se monta en <body> para que ningún
// panel la recorte, y se cierra con Escape o clic fuera.
export function Modal({
  title,
  onClose,
  children,
  width = 760,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body account-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
