// Cliente HTTP común para la API de server/. Vite reenvía /api al puerto 3001 en desarrollo.
// La sesión viaja en una cookie HttpOnly del mismo origen: no hay tokens en JavaScript.

export class ApiError extends Error {
  status: number;
  details: string[];
  constructor(message: string, status = 0, details: string[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: "same-origin",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      body?.error || body?.message || `Error HTTP ${res.status}`,
      res.status,
      body?.details || []
    );
  }
  return body as T;
}

export const json = (method: string, data?: unknown): RequestInit => ({
  method,
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});
