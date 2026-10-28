import React from "react";
import { X, ShieldAlert, ExternalLink } from "lucide-react";
import { useViewerStore } from "../store/useViewerStore";

export function CreditsModal() {
  const creditsOpen = useViewerStore((s) => s.creditsOpen);
  const setCreditsOpen = useViewerStore((s) => s.setCreditsOpen);

  if (!creditsOpen) return null;

  return (
    <div className="modal-backdrop" onClick={() => setCreditsOpen(false)}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2>Créditos, Licencias y Aviso Educativo</h2>
          <button
            className="icon-btn"
            onClick={() => setCreditsOpen(false)}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="disclaimer-box">
            <ShieldAlert size={20} />
            <div>
              <strong>Aviso importante (uso exclusivamente educativo):</strong>{" "}
              Esta aplicación es un proyecto de aprendizaje abierto y no
              comercial desarrollado por <strong>STEMENSOFT</strong>. No
              constituye consejo médico, diagnóstico ni herramienta clínica.
            </div>
          </div>

          <h3>1. Licencias del proyecto</h3>
          <ul>
            <li>
              <strong>Código fuente (`web/`, `scripts/`):</strong> Licencia{" "}
              <strong>MIT</strong> (© 2026 STEMENSOFT).
            </li>
            <li>
              <strong>Contenido 3D procesado y metadatos (`data/processed/`):</strong>{" "}
              Distribuido bajo{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                Creative Commons Attribution-ShareAlike 4.0 International (CC
                BY-SA 4.0) <ExternalLink size={12} />
              </a>
              .
            </li>
          </ul>

          <h3>2. Atribución de fuentes de terceros verificadas</h3>
          <table className="credits-table">
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Autor / Titular</th>
                <th>Licencia</th>
                <th>Modificaciones realizadas</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>BodyParts3D (v4.0)</strong>
                </td>
                <td>
                  The Database Center for Life Science (DBCLS), Japón
                  <br />
                  <small>
                    "BodyParts3D, © The Database Center for Life Science
                    licensed under CC Attribution 4.0 International"
                  </small>
                </td>
                <td>
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CC BY 4.0
                  </a>
                </td>
                <td>
                  Unión de 2.234 mallas <code>FJ*.obj</code> en 1.658
                  estructuras FMA, conversión a metros Y-up, agrupación en 10
                  archivos <code>.glb</code> por sistema y compresión{" "}
                  <code>EXT_meshopt_compression</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>HuBMAP 3D Reference Object Library</strong>
                </td>
                <td>
                  HuBMAP / Human Reference Atlas (Browne, Schlehlein, Herr II,
                  Quardokus, Bueckle, Börner, 2024)
                </td>
                <td>
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CC BY 4.0
                  </a>
                </td>
                <td>
                  Integración de 87 órganos de referencia masculinos y femeninos
                  y mapeo de sus subestructuras en <code>metadata.json</code>. Al
                  mostrarlos, el visor puede recolorear cada pieza según su tipo
                  (opción «Colores por pieza»); los colores son nuestros, no de HuBMAP.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Z-Anatomy (TA2.csv)</strong>
                </td>
                <td>Equipo Z-Anatomy (Gauthier Kervyn et al.)</td>
                <td>
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CC BY-SA 4.0
                  </a>
                </td>
                <td>
                  Nombres en latín y correspondencias terminológicas usados para
                  nombrar y traducir al español (con adaptación propia) las
                  estructuras de <code>metadata.json</code>, que por ello se
                  publica bajo CC BY-SA 4.0. No se utilizan sus mallas 3D ni se
                  redistribuye la tabla TA2 completa.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
