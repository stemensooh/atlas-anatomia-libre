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
        <li>Las <strong>vistas</strong> que guardes (posición de cámara y estado de la escena) y tus <strong>notas</strong> por estructura.</li>
        <li>
          Una <strong>cookie de sesión</strong> técnica (<code>bd_session</code>, 30 días) para
          mantenerte conectado. En el servidor solo se guarda su huella (hash), no la cookie.
        </li>
      </ul>

      <h3>Qué no guardamos</h3>
      <ul>
        <li>No pedimos correo, nombre real ni ningún otro dato personal.</li>
        <li>No hay analítica, publicidad ni cookies de terceros.</li>
        <li>
          Solo si abres un órgano de la pestaña <strong>HuBMAP</strong>, tu navegador lo descarga
          directamente del servidor oficial de HuBMAP (<code>cdn.humanatlas.io</code>), que puede
          ver tu dirección IP como cualquier web que visitas. No se le envía ningún otro dato.
        </li>
        <li>Sin sesión no se guarda nada: puedes usar el visor y jugar los cuestionarios públicos de forma anónima.</li>
      </ul>

      <h3>Qué se guarda en tu dispositivo</h3>
      <ul>
        <li>
          Para abrir rápido y funcionar <strong>sin conexión</strong>, el navegador guarda los archivos de
          la app, el catálogo de estructuras y los modelos 3D que has visto o descargado (incluidos los
          órganos de HuBMAP que hayas abierto). Son los mismos para todos: <strong>no contienen ningún
          dato personal</strong>.
        </li>
        <li>
          Tu sesión, tus resultados, vistas y notas <strong>nunca</strong> se guardan en esta caché: se
          piden siempre al servidor.
        </li>
        <li>
          Para liberar espacio: <strong>Capas → Uso sin conexión → Liberar espacio</strong>. Para borrarlo
          todo, desinstala la app o borra los datos del sitio en los ajustes del navegador.
        </li>
        <li>
          El navegador también recuerda algunas preferencias de pantalla (por ejemplo, el ancho del panel).
        </li>
      </ul>

      <h3>Quién ve tus datos</h3>
      <ul>
        <li>Tus cuestionarios son privados hasta que un docente o administrador los publica.</li>
        <li>Tus vistas y tus notas solo las ves tú.</li>
        <li>
          Tu historial de resultados lo ves tú. Además, si haces un cuestionario creado por un
          docente, ese docente ve tu nombre de usuario, tu puntuación y tus respuestas en ese
          cuestionario (para seguir el aprendizaje de su grupo). Los administradores pueden ver
          los resultados de cualquier cuestionario.
        </li>
        <li>
          Los administradores ven la lista de usuarios con el número de cuestionarios e intentos de
          cada uno, para gestionar las cuentas.
        </li>
      </ul>

      <h3>Tus derechos</h3>
      <p>
        Desde <strong>Mi perfil</strong> puedes ver tu historial, cambiar la contraseña y{" "}
        <strong>borrar tu cuenta</strong>, lo que elimina de inmediato tu usuario, tus cuestionarios,
        tus vistas, tus notas y todos tus resultados.
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
