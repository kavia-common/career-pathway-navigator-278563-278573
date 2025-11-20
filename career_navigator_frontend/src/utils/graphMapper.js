import { sanitizeLabel } from './sanitize';

/**
 * Normalize backend payload into nodes/links suitable for d3-force.
 * Backend contract (FastAPI):
 *  {
 *    nodes: [{ id, label, type, entity_id?, progress?, percent_complete? }],
 *    links: [{ source, target, type, level?, from?, is_gap?, color? }],
 *    meta: {...}
 *  }
 */
// PUBLIC_INTERFACE
export function mapGraphPayload(payload) {
  try {
    if (!payload || typeof payload !== 'object') {
      return { nodes: [], links: [], counts: { nodes: 0, links: 0 } };
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
          Number.isInteger(n?.percent_complete) && n.percent_complete >= 0 && n.percent_complete <= 100
            ? n.percent_complete
            : undefined,
      });
    }
    const nodeIdSet = new Set(nodes.map((n) => n.id));

    // Prefer backend.links; fallback to payload.edges for older mocks
    const rawLinks = Array.isArray(payload.links)
      ? payload.links
      : Array.isArray(payload.edges)
      ? payload.edges
      : [];

    const links = [];
    for (const e of rawLinks) {
      const src = typeof e?.source === 'object' ? e.source?.id : e?.source;
      const tgt = typeof e?.target === 'object' ? e.target?.id : e?.target;
      if (src === undefined || tgt === undefined || src === null || tgt === null) continue;
      const source = String(src);
      const target = String(tgt);
      // Ensure link endpoints exist; drop dangling edges
      if (!nodeIdSet.has(source) || !nodeIdSet.has(target) || source === target) continue;

      const ltype = e?.type || e?.kind || 'rel';
      const link = {
        source,
        target,
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
      counts: { nodes: nodes.length, links: links.length, gapNodes: gapNodeCount, gapLinks: gapLinkCount },
    };
  } catch (e) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[graphMapper] mapping failed, returning empty graph', e?.message || e);
    } catch {}
    return { nodes: [], links: [], counts: { nodes: 0, links: 0 } };
  }
}

/**
// PUBLIC_INTERFACE
 */
export function getMockGraph() {
  /** Small mock used when backend is unavailable so component renders */
  const nodes = [
    { id: 'role_current', label: 'Current Role', type: 'role', gap: 0 },
    { id: 'role_target', label: 'Target Role', type: 'role', gap: 0 },
    { id: 'skill_1', label: 'Architecture', type: 'skill', gap: 1 },
    { id: 'skill_2', label: 'Leadership', type: 'skill', gap: 2 },
    { id: 'skill_3', label: 'Strategy', type: 'skill', gap: 3 },
  ];
  const links = [
    { source: 'role_current', target: 'skill_1', kind: 'has', type: 'has' },
    { source: 'role_current', target: 'skill_2', kind: 'has', type: 'has' },
    { source: 'skill_1', target: 'role_target', kind: 'needs', type: 'needs' },
    { source: 'skill_2', target: 'role_target', kind: 'needs', type: 'needs' },
    { source: 'skill_3', target: 'role_target', kind: 'needs', type: 'needs' },
  ];
  return { nodes, links, counts: { nodes: nodes.length, links: links.length } };
}
