const BASE_URL = (process && process.env && process.env.REACT_APP_API_BASE) || 'http://localhost:3001';

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
      return { ok: false, status: res.status, data: json || null, error: 'Request failed' };
    }
    return { ok: true, status: res.status, data: json || null };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Network error' };
  }
}

/**
// PUBLIC_INTERFACE
 */
export async function apiPost(path, body = {}) {
  /** Perform POST request with JSON body and safe parsing */
  const url = (BASE_URL || '').replace(/\/+$/, '') + path;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok) {
      return { ok: false, status: res.status, data: json || null, error: 'Request failed' };
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
