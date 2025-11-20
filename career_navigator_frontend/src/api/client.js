/**
 * Simple API client helpers for the Career Navigator frontend.
 * Uses REACT_APP_BACKEND_URL as base. All functions return JSON.
 */

const BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_BASE ||
  "http://localhost:3001";

function buildUrl(path, params) {
  const url = new URL(path, BASE);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) {
        url.searchParams.set(k, v);
      }
    });
  }
  return url.toString();
}

// PUBLIC_INTERFACE
export async function getGraph(fromRole, toRole, progressMap) {
  /** Fetch graph; optional progressMap is encoded and echoed by backend on nodes. */
  const params = { fromRole, toRole };
  if (progressMap && typeof progressMap === "object") {
    try {
      params.progress = encodeURIComponent(JSON.stringify(progressMap));
    } catch {
      // ignore encoding errors
    }
  }
  const res = await fetch(buildUrl("/graph", params));
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
