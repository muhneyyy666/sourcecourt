import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { isIP } from "node:net";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnvFile } from "node:process";
import { crossExamine, engineStatus } from "./lib/ai.mjs";
import { publicCaseFile } from "./lib/case-data.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(root, "public");
const localEnv = join(root, ".env.local");

if (existsSync(localEnv)) {
  try {
    loadEnvFile(localEnv);
  } catch {
    process.stderr.write("Could not load .env.local; continuing in fixture mode.\n");
  }
}

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"]
]);

const SESSION_RATE_LIMIT = 20;
const NETWORK_RATE_LIMIT = 200;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_RATE_CLIENTS = 4096;

function securityHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Content-Type": contentType,
    "Cache-Control": contentType.startsWith("text/html") ? "no-store" : "no-cache",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, securityHeaders());
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

function clientId(request) {
  const remoteAddress = request.socket.remoteAddress || "local";
  if (process.env.TRUST_PROXY !== "1") return remoteAddress;

  const forwarded = request.headers["x-forwarded-for"];
  const candidate = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || "")
    .split(",")[0]
    .trim();
  return isIP(candidate) ? candidate : remoteAddress;
}

function permitRequest(rateWindows, id, limit) {
  const now = Date.now();
  const record = rateWindows.get(id);
  if (!record || now - record.startedAt > RATE_WINDOW_MS) {
    if (!record && rateWindows.size >= MAX_RATE_CLIENTS) {
      for (const [trackedId, tracked] of rateWindows) {
        if (now - tracked.startedAt > RATE_WINDOW_MS) rateWindows.delete(trackedId);
      }
      if (rateWindows.size >= MAX_RATE_CLIENTS) {
        rateWindows.delete(rateWindows.keys().next().value);
      }
    }
    rateWindows.set(id, { count: 1, startedAt: now });
    return true;
  }
  if (record.count >= limit) return false;
  record.count += 1;
  return true;
}

function sessionRateId(body, networkId) {
  const value = body?.safetyIdentifier;
  return typeof value === "string" && /^sc_[A-Za-z0-9_-]{20,80}$/.test(value)
    ? `session:${value}`
    : `network:${networkId}`;
}

async function serveStatic(pathname, response) {
  const decoded = decodeURIComponent(pathname);
  const requested = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const normalized = normalize(requested);
  const filePath = resolve(publicRoot, normalized);
  if (!filePath.startsWith(`${resolve(publicRoot)}/`)) {
    sendJson(response, 403, { error: "forbidden" });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not a file");
    const type = MIME.get(extname(filePath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, securityHeaders(type));
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: "not_found" });
  }
}

export function createSourceCourtServer() {
  const sessionRateWindows = new Map();
  const networkRateWindows = new Map();
  return createHttpServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          status: "ok",
          caseId: "SC-1854-01",
          engine: engineStatus()
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/case") {
        sendJson(response, 200, publicCaseFile());
        return;
      }

      if (url.pathname === "/api/cross-examine") {
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "method_not_allowed" });
          return;
        }
        const body = await readJson(request);
        const networkId = clientId(request);
        const sessionId = sessionRateId(body, networkId);
        const sessionAllowed = permitRequest(
          sessionRateWindows,
          sessionId,
          SESSION_RATE_LIMIT
        );
        const networkAllowed =
          sessionAllowed &&
          permitRequest(networkRateWindows, networkId, NETWORK_RATE_LIMIT);
        if (!sessionAllowed || !networkAllowed) {
          sendJson(response, 429, {
            error: "rate_limited",
            message: "The live bench is temporarily at capacity. Continue with the current record and try again shortly."
          });
          return;
        }
        const result = await crossExamine({
          claim: body.claim,
          citedSourceIds: body.citedSourceIds,
          safetyIdentifier: body.safetyIdentifier
        });
        sendJson(response, 200, result);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "not_found" });
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "method_not_allowed" });
        return;
      }

      await serveStatic(url.pathname, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error";
      const status = /too large/i.test(message)
        ? 413
        : /valid JSON/i.test(message)
          ? 400
          : /Cite at least|too short|unknown record source|do not match|safety identifier/i.test(message)
            ? 422
            : 500;
      sendJson(response, status, {
        error: status === 500 ? "server_error" : "invalid_request",
        message: status === 500 ? "The bench could not process this request." : message
      });
    }
  });
}

export async function startServer(
  port = Number(process.env.PORT || 4173),
  host = process.env.HOST?.trim() || "0.0.0.0"
) {
  const server = createSourceCourtServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolveListen);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  process.stdout.write(`SourceCourt listening on http://${host}:${actualPort}\n`);
  return server;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  startServer().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
