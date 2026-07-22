import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "") + "/api";
const TOKEN_KEY = "karigar_token";

// Persistent storage (IndexedDB/AsyncStorage on web) can silently fail to
// write in some browsers — most notably the in-app browsers used by
// WhatsApp/Instagram/Facebook (exactly how referral links get opened) and
// Safari private browsing. When that happens the old code had no fallback:
// the user would fill out the entire registration form and only discover
// at final submit that there was no token to send ("Missing token").
// Keeping an in-memory copy guarantees the current tab/session always has
// a working token even if the persistent write silently failed.
let inMemoryToken: string | null = null;

export async function getToken(): Promise<string | null> {
  const stored = await storage.secureGet(TOKEN_KEY, "");
  return stored || inMemoryToken;
}
export async function setToken(token: string) {
  inMemoryToken = token;
  await storage.secureSet(TOKEN_KEY, token);
}
export async function clearToken() {
  inMemoryToken = null;
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
      const controller = new AbortController();
      // Profile submissions include base64 photos and can be slow on weak
      // mobile data — give it 60s before giving up, instead of hanging forever.
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      break;
    } catch (e) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if ((e as any)?.name === "AbortError") {
        throw new ApiError("Upload timed out — please check your internet connection and try again.", 0);
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
