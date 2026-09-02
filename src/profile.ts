/**
 * Client for the light backend's profile service. When a match finishes, the
 * game reports the result here and it is persisted through POST /profile/record
 * (games_played += 1, victories += 1 on a win). The increment is server-owned,
 * so this only reports the outcome — it never carries the counters themselves.
 *
 * v1 has no login UI yet — accounts/auth is a separate work order — so the
 * bearer token is read from localStorage under `arena.token` if some other flow
 * has stored one. With no token (or an unreachable backend) the call is skipped
 * and logged: recording a match must never break the game.
 */
const TOKEN_KEY = "arena.token";
const DEFAULT_BASE_URL = "http://localhost:8080";

export interface ProfileService {
  /** Persist a finished match. Never rejects; resolves once done or skipped. */
  recordMatch(won: boolean): Promise<void>;
}

/** Base URL of the light backend, from `VITE_LIGHT_BACKEND_URL` or the default. */
function baseUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env.VITE_LIGHT_BACKEND_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** The stored session token, or null when there is none / storage is blocked. */
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function createProfileService(): ProfileService {
  return {
    async recordMatch(won: boolean): Promise<void> {
      const token = readToken();
      if (!token) {
        console.info("[profile] no session token; match result not persisted");
        return;
      }
      try {
        const res = await fetch(`${baseUrl()}/profile/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ won }),
        });
        if (!res.ok) console.warn(`[profile] record failed with status ${res.status}`);
      } catch (err) {
        console.warn("[profile] could not reach the profile service", err);
      }
    },
  };
}
