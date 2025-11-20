/**
 * Bootstrap runtime-safe public env variables into window.__ENV__.
 * This avoids referencing process at runtime in the browser while remaining CRA-compatible.
 * - No template literals are used to prevent unterminated template issues.
 * - Only REACT_APP_* variables are exposed.
 * - Basic sanitation is applied to values (strip control chars and truncate).
 */
(function initPublicEnv() {
  try {
    const w = typeof window !== "undefined" ? window : {};
    if (!w.__ENV__) w.__ENV__ = {};

    // Helper to read value from process.env (at build) or existing window.__ENV__ (at runtime)
    const read = (key, defVal) => {
      try {
        if (
          typeof process !== "undefined" &&
          process &&
          process.env &&
          Object.prototype.hasOwnProperty.call(process.env, key)
        ) {
          const v = process.env[key];
          if (typeof v === "string" && v.length > 0) return v;
        }
        if (w.__ENV__ && Object.prototype.hasOwnProperty.call(w.__ENV__, key)) {
          const v = w.__ENV__[key];
          if (typeof v === "string" && v.length > 0) return v;
        }
      } catch {
        // ignore inaccessible process/env
      }
      return defVal;
    };

    // Basic string sanitation: strip control characters and truncate extremely long values
    const sanitize = (value) => {
      try {
        const s = String(value).replace(/[\u0000-\u001F\u007F]/g, "");
        return s.length > 2048 ? s.slice(0, 2048) : s;
      } catch {
        return value;
      }
    };

    const DEFAULT_API_BASE = "https://vscode-internal-11652-beta.beta01.cloud.kavia.ai:3001";
    const rawBase = read("REACT_APP_API_BASE", DEFAULT_API_BASE);
    let API_BASE = DEFAULT_API_BASE;
    try {
      const s = String(rawBase).trim();
      if (s) API_BASE = s;
    } catch {
      API_BASE = DEFAULT_API_BASE;
    }
    w.__ENV__.REACT_APP_API_BASE = sanitize(API_BASE);

    // Whitelist of public env vars to pass through into the browser
    const allowed = [
      "REACT_APP_API_BASE",
      "REACT_APP_BACKEND_URL",
      "REACT_APP_FRONTEND_URL",
      "REACT_APP_WS_URL",
      "REACT_APP_NODE_ENV",
      "REACT_APP_NEXT_TELEMETRY_DISABLED",
      "REACT_APP_ENABLE_SOURCE_MAPS",
      "REACT_APP_PORT",
      "REACT_APP_TRUST_PROXY",
      "REACT_APP_LOG_LEVEL",
      "REACT_APP_HEALTHCHECK_PATH",
      "REACT_APP_FEATURE_FLAGS",
      "REACT_APP_EXPERIMENTS_ENABLED",
      // demo-only auth stub values (not secrets)
      "REACT_APP_AUTH_USER",
      "REACT_APP_AUTH_PASS",
    ];

    for (const key of allowed) {
      if (key === "REACT_APP_API_BASE") continue; // already handled
      const v = read(key, undefined);
      if (typeof v === "string" && v.length > 0) {
        w.__ENV__[key] = sanitize(v);
      }
    }

    // Visible hint in console if using default API base
    try {
      if (w.__ENV__.REACT_APP_API_BASE === DEFAULT_API_BASE && !read("REACT_APP_API_BASE", "")) {
        // eslint-disable-next-line no-console
        console.warn(
          "[ENV] Using default API base. To change, set REACT_APP_API_BASE in career_navigator_frontend/.env (e.g., http://localhost:3001)"
        );
      }
    } catch {
      // never throw during bootstrap
    }
  } catch {
    // never throw during bootstrap
  }
})();
