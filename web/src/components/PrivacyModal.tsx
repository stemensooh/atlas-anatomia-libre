import React from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Modal } from "./Modal";

export function PrivacyModal() {
  const user = useAuthStore((s) => s.user);
  const openModal = useAuthStore((s) => s.openModal);

  return (
    <Modal title="Privacidad y datos guardados" onClose={() => openModal(null)} width={640}>
      <p>
        Este visor es un proyecto educativo y no comercial de STEMENSOFT. Guardamos lo mínimo para
        que funcionen las cuentas y los cuestionarios.
      </p>

      <h3>Qué guardamos si creas una cuenta</h3>
      <ul>
        <li>
          <strong>Nombre de usuario</strong> y <strong>contraseña cifrada</strong> (scrypt). Nadie,
          ni los administradores, puede ver tu contraseña.
        </li>
        <li>Tu <strong>rol</strong> (estudiante, docente o administrador), la fecha de alta y la del último acceso.</li>
        <li>Los <strong>cuestionarios</strong> que generes o crees y los <strong>resultados</strong> de los que termines.</li>
        <li>
          Una <strong>cookie de sesión</strong> técnica (<code>bd_session</code>, 30 días) para
          mantenerte conectado. En el servidor solo se guarda su huella (hash), no la cookie.
        </li>
      </ul>

      <h3>Qué no guardamos</h3>
      <ul>
        <li>No pedimos correo, nombre real ni ningún otro dato personal.</li>
        <li>No hay analítica, publicidad ni cookies de terceros.</li>
        <li>Sin sesión no se guarda nada: puedes usar el visor y jugar los cuestionarios públicos de forma anónima.</li>
      </ul>

      <h3>Quién ve tus datos</h3>
      <ul>
        <li>Tus cuestionarios son privados hasta que un docente o administrador los publica.</li>
        <li>Tu historial de resultados solo lo ves tú.</li>
        <li>
          Los administradores ven la lista de usuarios con el número de cuestionarios e intentos de
          cada uno, para gestionar las cuentas.
        </li>
      </ul>

      <h3>Tus derechos</h3>
      <p>
        Desde <strong>Mi perfil</strong> puedes ver tu historial, cambiar la contraseña y{" "}
        <strong>borrar tu cuenta</strong>, lo que elimina de inmediato tu usuario, tus cuestionarios
        y todos tus resultados.
        {user && (
          <>
            {" "}
            <button className="link-inline" onClick={() => openModal("profile")}>
              Ir a Mi perfil
            </button>
          </>
        )}
      </p>
    </Modal>
  );
}
