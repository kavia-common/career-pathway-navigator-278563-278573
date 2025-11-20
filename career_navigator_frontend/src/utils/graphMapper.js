import { sanitizeLabel } from './sanitize';

/**
 * Normalize backend payload into nodes/links suitable for d3-force.
 * Expected backend payload example:
 * {
 *   nodes: [{ id, label, type: 'role'|'skill'|'gap', gap?: number }],
 *   edges: [{ source, target, kind }]
 * }
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
        gap: typeof n.gap === 'number' ? n.gap : 0,
      }))
    : [];
  const links = Array.isArray(payload.edges)
    ? payload.edges.map((e) => ({
        source: String(e.source),
        target: String(e.target),
        kind: e.kind || 'rel',
      }))
    : [];

  return {
    nodes,
    links,
    counts: { nodes: nodes.length, links: links.length },
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
