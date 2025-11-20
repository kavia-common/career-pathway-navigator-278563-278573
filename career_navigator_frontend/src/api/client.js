/**
 * Simple API client helpers for the Career Navigator frontend.
 * Uses REACT_APP_API_BASE (or REACT_APP_BACKEND_URL) as base. All functions return JSON.
 * Provides thin wrappers apiGet/apiPost for legacy imports in components.
 */

// Resolve API base from public env (window.__ENV__) first, then CRA process.env, then localhost.
const API_BASE =
  (typeof window !== "undefined" &&
    window.__ENV__ &&
    typeof window.__ENV__.REACT_APP_API_BASE === "string" &&
    window.__ENV__.REACT_APP_API_BASE) ||
  (typeof process !== "undefined" &&
    process &&
    process.env &&
    (process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL)) ||
  "http://localhost:3001";

function buildUrl(path, params) {
  const url = new URL(path, API_BASE);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) {
        url.searchParams.set(k, v);
      }
    });
  }
  return url.toString();
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export async function apiGet(path, params) {
  /** Thin GET wrapper returning { ok, data, status, error } without leaking sensitive info. */
  try {
    const res = await fetch(buildUrl(path, params), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      return { ok: false, data, status: res.status, error: "Request failed" };
    }
    return { ok: true, data, status: res.status };
  } catch {
    return { ok: false, data: null, status: 0, error: "Network error" };
  }
}

// PUBLIC_INTERFACE
export async function apiPost(path, body = {}, params) {
  /** Thin POST wrapper returning { ok, data, status, error } without leaking sensitive info. */
  try {
    const res = await fetch(buildUrl(path, params), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      return { ok: false, data, status: res.status, error: "Request failed" };
    }
    return { ok: true, data, status: res.status };
  } catch {
    return { ok: false, data: null, status: 0, error: "Network error" };
  }
}

// PUBLIC_INTERFACE
export async function getGraph(fromRole, toRole, progressMap, options = {}) {
  /** Fetch graph; optional progressMap is encoded and echoed by backend on nodes. Accepts options.signal (AbortController). */
  const params = { fromRole, toRole };
  if (progressMap && typeof progressMap === "object") {
    try {
      params.progress = encodeURIComponent(JSON.stringify(progressMap));
    } catch {
      // ignore encoding errors
    }
  }
  const res = await fetch(buildUrl("/graph", params), {
    method: "GET",
    signal: options.signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load graph");
  return res.json();
}

// PUBLIC_INTERFACE
export async function createRoadmap(payload) {
  /** Create/save a roadmap */
  const res = await fetch(buildUrl("/roadmaps"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create roadmap");
  return res.json();
}

// PUBLIC_INTERFACE
export async function listRoadmaps(user) {
  /** List saved roadmaps; optionally filter by user identifier */
  const res = await fetch(buildUrl("/roadmaps", user ? { user } : undefined));
  if (!res.ok) throw new Error("Failed to list roadmaps");
  return res.json();
}

// PUBLIC_INTERFACE
export async function getRoadmap(id, user) {
  /** Fetch a roadmap by id; optionally pass user to scope */
  const res = await fetch(buildUrl(`/roadmaps/${id}`, user ? { user } : undefined));
  if (!res.ok) throw new Error("Failed to fetch roadmap");
  return res.json();
}

// PUBLIC_INTERFACE
export async function updateRoadmap(id, payload, user) {
  /** Update roadmap name/graph_payload/notes */
  const res = await fetch(buildUrl(`/roadmaps/${id}`, user ? { user } : undefined), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update roadmap");
  return res.json();
}
