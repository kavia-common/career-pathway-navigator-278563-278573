/**
 * API client with safe environment resolution for browser runtime.
 * Avoids referencing Node's `process` at runtime to prevent "process is not defined" errors.
 * Resolution priority:
 * 1) window.__ENV__.REACT_APP_API_BASE (set by env-bootstrap.js or external script)
 * 2) process.env.REACT_APP_API_BASE (CRA replaces at build time; guarded)
 * 3) Preview-safe default (backend preview on 3001 over HTTPS)
 */

const DEFAULT_BASE = 'https://vscode-internal-11652-beta.beta01.cloud.kavia.ai:3001';

/**
 * Resolve the API base URL from safe sources.
 */
function resolveBaseUrl() {
  const fromWindow =
    (typeof window !== 'undefined' &&
      window.__ENV__ &&
      typeof window.__ENV__.REACT_APP_API_BASE === 'string' &&
      window.__ENV__.REACT_APP_API_BASE) ||
    '';

  // Guarded access to process to avoid runtime ReferenceError in the browser
  const fromProcess =
    (typeof process !== 'undefined' &&
      process &&
      process.env &&
      typeof process.env.REACT_APP_API_BASE === 'string' &&
      process.env.REACT_APP_API_BASE) ||
    '';

  const raw = fromWindow || fromProcess || DEFAULT_BASE;
  // Normalize: do not keep trailing spaces; leave slashes normalization to callers
  return String(raw).trim();
}

const BASE_URL = resolveBaseUrl();

// Visible hint if falling back to default; never crash on consoles without process/window
try {
  const usedDefault = BASE_URL === DEFAULT_BASE;
  const hasWindow = typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.REACT_APP_API_BASE;
  const hasProcess = typeof process !== 'undefined' && process?.env?.REACT_APP_API_BASE;
  if (usedDefault && !(hasWindow || hasProcess)) {
    // eslint-disable-next-line no-console
    console.warn(
      '[API] Using default API base. To change, set REACT_APP_API_BASE in career_navigator_frontend/.env (e.g., http://localhost:3001)'
    );
  }
} catch {
  // no-op
}

/**
 * Safely parse JSON without throwing; returns null on failure.
 */
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
// PUBLIC_INTERFACE
 */
export async function apiGet(path, params = {}) {
  /**
   * Perform GET request to backend with basic error handling
   * path: string like '/roles'
   * params: object appended as query string
   * returns: { ok: boolean, status: number, data: any|null, error?: string }
   */
  const base = (BASE_URL || '').replace(/\/*$/, '');
  const url = new URL(base + path);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(String(k), String(v));
    }
  });
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    });
    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok) {
      return { ok: false, status: res.status, data: json || null, error: json?.detail || 'Request failed' };
    }
    return { ok: true, status: res.status, data: json || null };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: 'Network error' };
  }
}

/**
// PUBLIC_INTERFACE
 */
export async function apiPost(path, body = {}, query = undefined) {
  /**
   * Perform POST request with optional query params and safe parsing
   * path: string like '/roles/{name}/progress'
   * body: request body object (optional)
   * query: object appended as query string (optional)
   */
  const base = (BASE_URL || '').replace(/\/*$/, '');
  const url = new URL(base + path);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(String(k), String(v));
      }
    });
  }
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body && Object.keys(body).length ? JSON.stringify(body) : undefined,
      credentials: 'omit',
    });
    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok) {
      return { ok: false, status: res.status, data: json || null, error: json?.detail || 'Request failed' };
    }
    return { ok: true, status: res.status, data: json || null };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Network error' };
  }
}

/**
// PUBLIC_INTERFACE
 */
export function getBaseUrl() {
  /**
   * Expose configured API base URL
   */
  return BASE_URL;
}

/**
// PUBLIC_INTERFACE
 */
export async function fetchRoleById(roleId) {
  /** Fetch role detail by numeric id */
  const id = String(roleId || '').trim();
  if (!id) return { ok: false, status: 422, data: null, error: 'Missing roleId' };
  return apiGet(`/roles/by-id/${encodeURIComponent(id)}`);
}

/**
// PUBLIC_INTERFACE
 */
export async function fetchRoleByName(roleName) {
  /** Fetch role detail by name */
  const name = String(roleName || '').trim();
  if (!name) return { ok: false, status: 422, data: null, error: 'Missing roleName' };
  return apiGet(`/roles/${encodeURIComponent(name)}`);
}

/**
// PUBLIC_INTERFACE
 */
export async function fetchSkillById(skillId) {
  /** Fetch skill detail by numeric id */
  const id = String(skillId || '').trim();
  if (!id) return { ok: false, status: 422, data: null, error: 'Missing skillId' };
  return apiGet(`/skills/${encodeURIComponent(id)}`);
}

/**
// PUBLIC_INTERFACE
 */
export async function fetchSkillByName(skillName) {
  /** Fetch skill detail by name */
  const name = String(skillName || '').trim();
  if (!name) return { ok: false, status: 422, data: null, error: 'Missing skillName' };
  return apiGet(`/skills/by-name/${encodeURIComponent(name)}`);
}
