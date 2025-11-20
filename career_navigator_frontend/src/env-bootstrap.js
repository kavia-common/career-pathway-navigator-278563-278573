/**
 * Bootstrap runtime-safe public env variables into window.__ENV__.
 * This avoids referencing process at runtime in the browser while remaining CRA-compatible.
 */
(function initPublicEnv() {
  // Ensure the global container exists
  if (!window.__ENV__) {
    window.__ENV__ = {};
  }

  // Read CRA public env variables (injected at build time)
  // Note: Using direct REACT_APP_* constants here is safe because CRA replaces them during build.
  // However, in some preview environments this may be undefined; provide robust defaults.
  const API_BASE =
    (typeof process !== 'undefined' &&
      process &&
      process.env &&
      process.env.REACT_APP_API_BASE) ||
    (typeof window !== 'undefined' &&
      window.__ENV__ &&
      window.__ENV__.REACT_APP_API_BASE) ||
    // Preview-safe HTTPS default
    'https://vscode-internal-11652-beta.beta01.cloud.kavia.ai:3001';

  // Resolve optional public auth stub variables (do not expose secrets; these are demo-only)
  const AUTH_USER =
    (typeof process !== 'undefined' &&
      process &&
      process.env &&
      process.env.REACT_APP_AUTH_USER) ||
    (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.REACT_APP_AUTH_USER) ||
    undefined;

  const AUTH_PASS =
    (typeof process !== 'undefined' &&
      process &&
      process.env &&
      process.env.REACT_APP_AUTH_PASS) ||
    (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.REACT_APP_AUTH_PASS) ||
    undefined;

  // Populate window.__ENV__ with normalized values
  window.__ENV__.REACT_APP_API_BASE = API_BASE;
  if (AUTH_USER) window.__ENV__.REACT_APP_AUTH_USER = AUTH_USER;
  if (AUTH_PASS) window.__ENV__.REACT_APP_AUTH_PASS = AUTH_PASS;

  // Optional: expose more public variables here in the future, e.g. SITE_URL
  // window.__ENV__.REACT_APP_SITE_URL = process.env.REACT_APP_SITE_URL || window.location.origin;

  // Visible hint to help configuration in previews
  try {
    if (!((typeof process !== 'undefined' && process?.env?.REACT_APP_API_BASE) || (window.__ENV__ && window.__ENV__.REACT_APP_API_BASE !== API_BASE))) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ENV] Using default API base. To change, set REACT_APP_API_BASE in career_navigator_frontend/.env (e.g., http://localhost:3001)'
      );
    }
  } catch {
    // no-op: never throw during bootstrap
  }
})();
