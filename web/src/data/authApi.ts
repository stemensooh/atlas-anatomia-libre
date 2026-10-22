import { json, request } from "./api";
import { QuizAttempt } from "./quizApi";

export type Role = "estudiante" | "docente" | "admin";

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
}

export interface AdminUser extends SessionUser {
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  quizCount: number;
  attemptCount: number;
}

export const ROLE_LABEL: Record<Role, string> = {
  estudiante: "Estudiante",
  docente: "Docente",
  admin: "Administrador",
};

const RANK: Record<Role, number> = { estudiante: 1, docente: 2, admin: 3 };
export const hasRole = (user: SessionUser | null, min: Role) => !!user && RANK[user.role] >= RANK[min];

export const fetchMe = () => request<{ user: SessionUser | null }>("/api/auth/me");

export const register = (username: string, password: string) =>
  request<{ user: SessionUser }>("/api/auth/register", json("POST", { username, password }));

export const login = (username: string, password: string) =>
  request<{ user: SessionUser }>("/api/auth/login", json("POST", { username, password }));

export const logout = () => request<void>("/api/auth/logout", json("POST"));

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<void>("/api/auth/password", json("POST", { currentPassword, newPassword }));

export const deleteAccount = (password: string) =>
  request<void>("/api/auth/me", json("DELETE", { password }));

export const listMyAttempts = () => request<QuizAttempt[]>("/api/me/attempts");

export const adminListUsers = () => request<AdminUser[]>("/api/admin/users");

export const adminUpdateUser = (id: number, patch: { role?: Role; isActive?: boolean }) =>
  request<AdminUser>(`/api/admin/users/${id}`, json("PATCH", patch));

export const adminResetPassword = (id: number, newPassword: string) =>
  request<void>(`/api/admin/users/${id}/password`, json("POST", { newPassword }));

export const adminDeleteUser = (id: number) => request<void>(`/api/admin/users/${id}`, json("DELETE"));
