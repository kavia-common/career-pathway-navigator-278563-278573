import { sanitizeLabel } from './sanitize';

/**
 * Normalize backend payload into nodes/links suitable for further preparation by the Graph component.
 * IMPORTANT: Do NOT bind 'source'/'target' here. Only emit sourceId/targetId so D3 isn't given strings
 * for endpoints and we can validate/map to actual node objects in the component.
 *
 * Backend contract (FastAPI):
 *  {
 *    nodes: [{ id, label, type, entity_id?, progress?, percent_complete? }],
 *    links: [{ source, target, type, level?, from?, is_gap?, color? }],
 *    meta: {...}
 *  }
 */

// PUBLIC_INTERFACE
export function mapGraphPayload(payload) {
  /**
   * PUBLIC: Convert various backend/legacy shapes into a normalized graph object:
   * - nodes: [{ id: string, type, label, entity_id? ... }]
   * - links: [{ sourceId: string, targetId: string, type, kind, ... }]  // no source/target bound here
   * - meta: passthrough object if present
   * - counts: simple stats
   */
  try {
    if (!payload || typeof payload !== 'object') {
      return { nodes: [], links: [], meta: {}, counts: { nodes: 0, links: 0 } };
    }

    const rawNodes = Array.isArray(payload.nodes)
      ? payload.nodes
      : Array.isArray(payload.vertices)
      ? payload.vertices
      : [];

    // Normalize nodes and ensure stable string ids
    const nodes = [];
    for (const n of rawNodes) {
      const idRaw = n?.id ?? n?.label ?? null;
      if (idRaw === null || idRaw === undefined) continue;
      const id = String(idRaw);
      const labelSrc = n?.label ?? id;
      nodes.push({
        id,
        label: sanitizeLabel(labelSrc),
        type: n?.type || 'skill',
        entity_id:
          typeof n?.entity_id === 'number'
            ? n.entity_id
            : typeof n?.entity_id === 'string' && /^\d+$/.test(n.entity_id)
            ? Number(n.entity_id)
            : undefined,
        is_gap: typeof n?.is_gap === 'boolean' ? n.is_gap : undefined,
        color: typeof n?.color === 'string' ? n.color : undefined,
        gap: typeof n?.gap === 'number' ? n.gap : 0,
        progress: typeof n?.progress === 'string' ? n.progress : undefined,
        percent_complete:
          Number.isInteger(n?.percent_complete) &&
          n.percent_complete >= 0 &&
          n.percent_complete <= 100
            ? n.percent_complete
            : undefined,
      });
    }

    // Prefer backend.links; fallback to payload.edges for older mocks
    const rawLinks = Array.isArray(payload.links)
      ? payload.links
      : Array.isArray(payload.edges)
      ? payload.edges
      : [];

    const links = [];
    for (const e of rawLinks) {
      // Backward compatibility: if sourceId/targetId missing, coerce from source/target (can be strings or {id})
      let src =
        e?.sourceId ??
        (typeof e?.source === 'object' ? e?.source?.id : e?.source);
      let tgt =
        e?.targetId ??
        (typeof e?.target === 'object' ? e?.target?.id : e?.target);

      if (src === undefined || src === null || tgt === undefined || tgt === null) {
        // skip incomplete links; Graph.jsx will log/validate further if needed
        continue;
      }

      const sourceId = String(src);
      const targetId = String(tgt);

      const ltype = e?.type || e?.kind || 'rel';
      const link = {
        sourceId,
        targetId,
        type: ltype,
        kind: ltype, // maintain compatibility for callers using kind
        level: typeof e?.level === 'number' ? e.level : undefined,
        from: e?.from || e?.from_,
        is_gap: typeof e?.is_gap === 'boolean' ? e.is_gap : undefined,
        color: typeof e?.color === 'string' ? e.color : undefined,
      };
      // If backend marked a gap but no color provided, default to tailwind red-500 hex
      if (link.is_gap && !link.color) {
        link.color = '#ef4444';
      }
      links.push(link);
    }

    const meta = typeof payload.meta === 'object' && payload.meta ? payload.meta : {};

    const gapNodeCount = nodes.filter((n) => n.is_gap || n.color === '#ef4444').length;
    const gapLinkCount = links.filter((l) => l.is_gap || l.color === '#ef4444').length;
    try {
      // Non-blocking debug info to help verify at least 3 red gap items appear
      // eslint-disable-next-line no-console
      console.debug('[graphMapper] mapped', {
        nodes: nodes.length,
        links: links.length,
        gapNodeCount,
        gapLinkCount,
      });
    } catch (_) {
      // ignore console failures in strict environments
    }
    return {
      nodes,
      links,
      meta,
      counts: { nodes: nodes.length, links: links.length, gapNodes: gapNodeCount, gapLinks: gapLinkCount },
    };
  } catch (e) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[graphMapper] mapping failed, returning empty graph', e?.message || e);
    } catch {}
    return { nodes: [], links: [], meta: {}, counts: { nodes: 0, links: 0 } };
  }
}

/**
// PUBLIC_INTERFACE
 */
export function getMockGraph() {
  /** Small mock used when backend is unavailable so component renders. Note links use sourceId/targetId. */
  const nodes = [
    { id: 'role_current', label: 'Current Role', type: 'role', gap: 0 },
    { id: 'role_target', label: 'Target Role', type: 'role', gap: 0 },
    { id: 'skill_1', label: 'Architecture', type: 'skill', gap: 1 },
    { id: 'skill_2', label: 'Leadership', type: 'skill', gap: 2 },
    { id: 'skill_3', label: 'Strategy', type: 'skill', gap: 3 },
  ];
  const links = [
    { sourceId: 'role_current', targetId: 'skill_1', kind: 'has', type: 'has' },
    { sourceId: 'role_current', targetId: 'skill_2', kind: 'has', type: 'has' },
    { sourceId: 'skill_1', targetId: 'role_target', kind: 'needs', type: 'needs' },
    { sourceId: 'skill_2', targetId: 'role_target', kind: 'needs', type: 'needs' },
    { sourceId: 'skill_3', targetId: 'role_target', kind: 'needs', type: 'needs' },
  ];
  return { nodes, links, meta: {}, counts: { nodes: nodes.length, links: links.length } };
}
