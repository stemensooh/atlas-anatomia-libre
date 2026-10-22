import React, { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronDown, LogIn, LogOut, Shield, ShieldCheck, UserCircle2 } from "lucide-react";
import { ROLE_LABEL } from "../data/authApi";
import { useAuthStore } from "../store/useAuthStore";
import { AdminUsersModal } from "./AdminUsersModal";
import { AuthModal } from "./AuthModal";
import { PrivacyModal } from "./PrivacyModal";
import { ProfileModal, LocateStructure } from "./ProfileModal";
import { ViewsModal } from "./ViewsModal";

// Botón de cuenta de la barra superior: "Iniciar sesión" o el menú del usuario.
export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const serverOnline = useAuthStore((s) => s.serverOnline);
  const openModal = useAuthStore((s) => s.openModal);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!ready) return null;
  if (!serverOnline) {
    return (
      <span className="user-offline" title="Arranca el servidor (server/) para usar cuentas">
        Sin servidor de cuentas
      </span>
    );
  }

  if (!user) {
    return (
      <button className="btn-cam" onClick={() => openModal("login")}>
        <LogIn size={14} />
        <span>Iniciar sesión</span>
      </button>
    );
  }

  const go = (modal: Parameters<typeof openModal>[0]) => {
    setOpen(false);
    openModal(modal);
  };

  return (
    <div className="user-menu" ref={ref}>
      <button className="btn-cam user-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <UserCircle2 size={15} />
        <span>{user.username}</span>
        <small className={`role-badge role-${user.role}`}>{ROLE_LABEL[user.role]}</small>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <button role="menuitem" onClick={() => go("profile")}>
            <UserCircle2 size={14} /> Mi perfil
          </button>
          <button role="menuitem" onClick={() => go("views")}>
            <Bookmark size={14} /> Mis vistas
          </button>
          {user.role === "admin" && (
            <button role="menuitem" onClick={() => go("admin")}>
              <Shield size={14} /> Administración
            </button>
          )}
          <button role="menuitem" onClick={() => go("privacy")}>
            <ShieldCheck size={14} /> Privacidad
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

// Ventanas de cuenta abiertas desde cualquier sitio con useAuthStore().openModal(...).
export function AccountModals({ locate }: { locate: LocateStructure }) {
  const modal = useAuthStore((s) => s.modal);
  const user = useAuthStore((s) => s.user);
  if (modal === "login" || modal === "register") return <AuthModal mode={modal} />;
  if (modal === "privacy") return <PrivacyModal />;
  if (modal === "profile" && user) return <ProfileModal locate={locate} />;
  if (modal === "views" && user) return <ViewsModal />;
  if (modal === "admin" && user?.role === "admin") return <AdminUsersModal />;
  return null;
}
