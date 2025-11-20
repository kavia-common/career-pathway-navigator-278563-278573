import { sanitizeLabel } from './sanitize';

/**
 * Normalize backend payload into nodes/links suitable for d3-force.
 * Backend contract (FastAPI):
 *  {
 *    nodes: [{ id, label, type, entity_id? }],
 *    links: [{ source, target, type, level?, from? }],
 *    meta: {...}
 *  }
 */
// PUBLIC_INTERFACE
export function mapGraphPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { nodes: [], links: [], counts: { nodes: 0, links: 0 } };
  }
  const nodes = Array.isArray(payload.nodes)
    ? payload.nodes.map((n) => ({
        id: String(n.id),
        label: sanitizeLabel(n.label ?? n.id),
        type: n.type || 'skill',
        entity_id:
          typeof n.entity_id === 'number'
            ? n.entity_id
            : typeof n.entity_id === 'string' && /^\d+$/.test(n.entity_id)
            ? Number(n.entity_id)
            : undefined,
        is_gap: typeof n.is_gap === 'boolean' ? n.is_gap : undefined,
        color: typeof n.color === 'string' ? n.color : undefined,
        gap: typeof n.gap === 'number' ? n.gap : 0,
      }))
    : [];
  // Prefer backend.links; fallback to payload.edges for older mocks
  const rawLinks = Array.isArray(payload.links)
    ? payload.links
    : Array.isArray(payload.edges)
    ? payload.edges
    : [];
  const links = rawLinks.map((e) => {
    const link = {
      source: String(typeof e.source === 'object' ? e.source.id : e.source),
      target: String(typeof e.target === 'object' ? e.target.id : e.target),
      kind: e.type || e.kind || 'rel',
      level: typeof e.level === 'number' ? e.level : undefined,
      from: e.from || e.from_,
      is_gap: typeof e.is_gap === 'boolean' ? e.is_gap : undefined,
      color: typeof e.color === 'string' ? e.color : undefined,
    };
    // If backend marked a gap but no color provided, default to tailwind red-500 hex
    if (link.is_gap && !link.color) {
      link.color = '#ef4444';
    }
    return link;
  });

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
    { source: 'role_current', target: 'skill_1', kind: 'has' },
    { source: 'role_current', target: 'skill_2', kind: 'has' },
    { source: 'skill_1', target: 'role_target', kind: 'needs' },
    { source: 'skill_2', target: 'role_target', kind: 'needs' },
    { source: 'skill_3', target: 'role_target', kind: 'needs' },
  ];
  return { nodes, links, counts: { nodes: nodes.length, links: links.length } };
}
