const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)
  ?? 'https://trotro-api.onrender.com/api';

const TOKEN_KEY = 'trotro.admin.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header (login only). */
  anonymous?: boolean;
};

/**
 * Thin fetch wrapper. A 401 clears the stored token and dispatches
 * `trotro:unauthorized`, which AuthContext listens for to bounce to /login —
 * that way an expired JWT logs out every open tab instead of showing errors.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the API. Check your connection and VITE_API_URL.');
  }

  if (response.status === 401 && !anonymous) {
    clearToken();
    window.dispatchEvent(new Event('trotro:unauthorized'));
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const message = (payload as { error?: { message?: string }; message?: string } | null)
      ?.error?.message
      ?? (payload as { message?: string } | null)?.message
      ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const buildQuery = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};
