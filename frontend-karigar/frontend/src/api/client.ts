import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "") + "/api";
const TOKEN_KEY = "karigar_token";

export async function getToken(): Promise<string | null> {
  return storage.secureGet(TOKEN_KEY, "");
}
export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}
export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

type Options = { method?: string; body?: any; auth?: boolean };

export async function apiFetch<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  // Retry once if backend is sleeping (Render free tier)
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      break;
    } catch (e) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }
  if (!res) throw new ApiError("Network error", 0);  if (!res.ok) {
    let detail = "Something went wrong";
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export { BASE };
