import React from "react";
import { EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { InstallPlatform } from "../data/install";
import { Modal } from "./Modal";

// Instrucciones para instalar la app donde el navegador no ofrece un diálogo propio
// (Safari en iPhone/iPad, Firefox, etc.).
export function InstallHelpModal({ platform, onClose }: { platform: InstallPlatform; onClose: () => void }) {
  return (
    <Modal title="Instalar el atlas como app" onClose={onClose} width={460}>
      {platform === "ios" ? (
        <>
          <p>En iPhone y iPad se instala desde <strong>Safari</strong>:</p>
          <ol className="install-steps">
            <li>
              Toca <strong>Compartir</strong> <Share size={15} aria-label="(icono de compartir)" /> en la barra de Safari.
            </li>
            <li>
              Elige <strong>Añadir a pantalla de inicio</strong> <SquarePlus size={15} aria-hidden="true" />.
            </li>
            <li>
              Toca <strong>Añadir</strong>. El atlas aparecerá con su icono y se abrirá a pantalla completa.
            </li>
          </ol>
          <p className="account-note">
            Si usas otro navegador en iOS (Chrome, Firefox…), ábrelo primero en Safari.
          </p>
        </>
      ) : (
        <>
          <p>Tu navegador no ofrece un botón de instalación directo. Normalmente se instala así:</p>
          <ol className="install-steps">
            <li>
              Abre el menú del navegador <EllipsisVertical size={15} aria-hidden="true" />.
            </li>
            <li>
              Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
            </li>
          </ol>
          <p className="account-note">
            En Chrome y Edge (Android, Windows, macOS, Linux) también aparece un icono de instalar en
            la barra de direcciones.
          </p>
        </>
      )}
      <p className="account-note">
        Una vez instalada, en <strong>Capas → Uso sin conexión</strong> puedes descargar un cuerpo
        para usarlo sin internet.
      </p>
    </Modal>
  );
}
