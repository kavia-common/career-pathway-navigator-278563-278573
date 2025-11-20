const DEFAULT_BASE = 'https://vscode-internal-31939-beta.beta01.cloud.kavia.ai:3001';
const BASE_URL =
  (typeof process !== 'undefined' &&
    process &&
    process.env &&
    process.env.REACT_APP_API_BASE) ||
  DEFAULT_BASE;

// Visible hint in console if falling back to default (helps preview env config)
if (!process?.env?.REACT_APP_API_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    '[API] Using DEFAULT_BASE. To change, set REACT_APP_API_BASE in career_navigator_frontend/.env (e.g., http://localhost:3001)',
  );
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
  /** Perform GET request to backend with basic error handling */
  const url = new URL((BASE_URL || '').replace(/\/+$/, '') + path);
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
  /** Perform POST request with optional query params and safe parsing */
  const base = (BASE_URL || '').replace(/\/+$/, '');
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
  /** Expose configured API base URL */
  return BASE_URL;
}
