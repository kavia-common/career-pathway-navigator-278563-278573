const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/g;

/**
// PUBLIC_INTERFACE
 */
export function sanitizeLabel(input, maxLen = 80) {
  /** Strip control chars and trim length to avoid rendering issues */
  if (input === null || input === undefined) return '';
  const s = String(input).replace(CONTROL_CHARS_REGEX, '').trim();
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}
