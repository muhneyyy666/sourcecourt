import assert from "node:assert/strict";
import { startServer } from "../server.mjs";

const REQUIRED_MODEL = "gpt-5.6-sol";
const REQUIRED_EFFORT = "max";

const server = await startServer(0, "127.0.0.1");
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200, "health endpoint did not return HTTP 200");
  const health = await healthResponse.json();

  if (health.engine.mode !== "live") {
    throw new Error("live configuration is absent or fixture mode is forced; run `npm run configure` first");
  }
  assert.equal(health.engine.model, REQUIRED_MODEL, `model must be ${REQUIRED_MODEL}`);
  assert.equal(health.engine.reasoningEffort, REQUIRED_EFFORT, "reasoning effort must stay at max");

  const response = await fetch(`${baseUrl}/api/cross-examine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      claim: "The Broad Street pump was the sole cause of the Soho cholera outbreak [S01] [S02].",
      citedSourceIds: ["S01", "S02"],
      safetyIdentifier: "sc_sourcecourt_live_smoke_2026"
    })
  });
  const payload = await response.json();
  assert.equal(response.status, 200, `cross-examination returned HTTP ${response.status}`);
  assert.equal(
    payload.engine?.mode,
    "live",
    `upstream call fell back to fixture (${payload.engine?.fallbackReason || "unknown reason"})`
  );
  assert.equal(payload.engine.model, REQUIRED_MODEL, `runtime model must be ${REQUIRED_MODEL}`);
  assert.equal(payload.engine.reasoningEffort, REQUIRED_EFFORT, "runtime reasoning effort must be max");
  assert.equal(payload.engine.route, "responses", "final demo gate requires the Responses API route");
  assert.equal(
    payload.engine.providerVerification?.model,
    "matched",
    "provider did not report a model matching the requested GPT-5.6 model"
  );
  assert.equal(
    payload.engine.providerVerification?.reasoningEffort,
    "matched",
    "final demo gate requires the provider to report max reasoning effort"
  );
  assert.equal(payload.engine.providerStatus, "completed", "Responses request was not reported completed");
  assert.equal(payload.engine.providerIncompleteDetails, null, "Responses request reported incomplete details");
  assert.ok(payload.engine.requestId, "provider did not return a request ID");
  assert.ok(Array.isArray(payload.challenge?.sourceIds), "challenge did not contain verified source IDs");
  assert.ok(payload.challenge.sourceIds.length > 0, "challenge contained no verified source IDs");
  assert.ok(
    payload.challenge.verifiedSources?.every(
      (source) => source.id && source.excerpt && source.url?.startsWith("https://")
    ),
    "challenge did not contain server-owned source provenance"
  );

  process.stdout.write(
    [
      "Live smoke PASS",
      `model: ${payload.engine.model}`,
      `reasoning effort: ${payload.engine.reasoningEffort}`,
      `route: ${payload.engine.route}`,
      `latency: ${payload.engine.latencyMs} ms`,
      `provider model: ${payload.engine.providerModel} (matched)`,
      `provider reasoning effort: ${payload.engine.providerVerification.reasoningEffort}`,
      `provider status: ${payload.engine.providerStatus}`,
      `verified source IDs: ${payload.challenge.sourceIds.join(", ")}`,
      "upstream request ID: present",
      "No API key or Base URL was printed."
    ].join("\n") + "\n"
  );
} catch (error) {
  process.stderr.write(`Live smoke FAIL: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}
