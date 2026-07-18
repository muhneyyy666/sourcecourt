const configuredUrl = process.env.SOURCECOURT_PUBLIC_URL || "https://sourcecourt.online/";

let baseUrl;
try {
  baseUrl = new URL(configuredUrl);
} catch {
  throw new Error("SOURCECOURT_PUBLIC_URL must be a valid URL");
}

if (baseUrl.protocol !== "https:") {
  throw new Error("The public smoke target must use HTTPS");
}

baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchChecked(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20_000)
  });
}

const root = await fetchChecked(baseUrl);
const html = await root.text();
requireCheck(root.status === 200, `Public root returned HTTP ${root.status}`);
requireCheck(/<title>SourceCourt\b/i.test(html), "Public root did not contain the SourceCourt title");
requireCheck(
  /frame-ancestors 'none'/.test(root.headers.get("content-security-policy") || ""),
  "Public root is missing the expected Content Security Policy"
);
requireCheck(
  /^max-age=\d+/.test(root.headers.get("strict-transport-security") || ""),
  "Public root is missing HSTS"
);
requireCheck(root.headers.get("x-content-type-options") === "nosniff", "Public root is missing nosniff");
requireCheck(root.headers.get("x-frame-options") === "DENY", "Public root is missing frame denial");

const healthResponse = await fetchChecked(new URL("/api/health", baseUrl));
const health = await healthResponse.json();
requireCheck(healthResponse.status === 200, `Health endpoint returned HTTP ${healthResponse.status}`);
requireCheck(health.status === "ok", "Health endpoint did not report ok");
requireCheck(health.engine?.mode === "live", "Public engine is not configured for live mode");
requireCheck(health.engine?.model === "gpt-5.6-sol", "Public engine model is not gpt-5.6-sol");
requireCheck(health.engine?.reasoningEffort === "max", "Public engine reasoning effort is not max");
requireCheck(health.engine?.configured === true, "Public engine is missing its server-side key configuration");

if (!baseUrl.hostname.startsWith("www.")) {
  const wwwUrl = new URL(baseUrl);
  wwwUrl.hostname = `www.${baseUrl.hostname}`;
  const wwwResponse = await fetchChecked(wwwUrl, { redirect: "manual" });
  requireCheck([301, 302, 307, 308].includes(wwwResponse.status), `www returned HTTP ${wwwResponse.status}`);
  requireCheck(
    new URL(wwwResponse.headers.get("location"), wwwUrl).href === baseUrl.href,
    "www did not redirect to the canonical apex"
  );
}

process.stdout.write(
  [
    "Public smoke PASS",
    `origin=${baseUrl.origin}`,
    `engine=${health.engine.mode}`,
    `model=${health.engine.model}`,
    `reasoning_effort=${health.engine.reasoningEffort}`
  ].join("\n") + "\n"
);
