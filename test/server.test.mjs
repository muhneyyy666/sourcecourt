import test from "node:test";
import assert from "node:assert/strict";

process.env.SOURCECOURT_FORCE_FIXTURE = "1";
const { startServer } = await import("../server.mjs");

async function withServer(run) {
  const server = await startServer(0, "127.0.0.1");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postValidChallenge(baseUrl, forwardedFor, safetyIdentifier) {
  const response = await fetch(`${baseUrl}/api/cross-examine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {})
    },
    body: JSON.stringify({
      claim: "The pump was the sole cause of the outbreak [S01] [S02].",
      citedSourceIds: ["S01", "S02"],
      ...(safetyIdentifier ? { safetyIdentifier } : {})
    })
  });
  await response.arrayBuffer();
  return response.status;
}

test("health and case endpoints expose no credentials", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
    const caseFile = await fetch(`${baseUrl}/api/case`).then((response) => response.json());
    assert.equal(health.status, "ok");
    assert.equal(health.engine.mode, "fixture");
    assert.equal(caseFile.id, "SC-1854-01");
    assert.equal(caseFile.sources.length, 10);
    assert.doesNotMatch(JSON.stringify({ health, caseFile }), /api[_-]?key|bearer\s+sk-/i);
  });
});

test("the default listener is routable in a production container", async () => {
  const previous = process.env.HOST;
  delete process.env.HOST;
  const server = await startServer(0);
  try {
    assert.equal(server.address().address, "0.0.0.0");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previous === undefined) delete process.env.HOST;
    else process.env.HOST = previous;
  }
});

test("fixture cross-examination completes the public API contract", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/cross-examine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: "The pump was the sole cause of the outbreak [S01] [S02].",
        citedSourceIds: ["S01", "S02"]
      })
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.engine.mode, "fixture");
    assert.equal(payload.challenge.id, "fixture-overclaim");
    assert.ok(payload.challenge.verifiedSources.every((source) => source.excerpt && source.url));
  });
});

test("invalid short claims fail without clearing server state", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/cross-examine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim: "Too short", citedSourceIds: ["S01", "S02"] })
    });
    const payload = await response.json();
    assert.equal(response.status, 422);
    assert.equal(payload.error, "invalid_request");
  });
});

test("unknown or mismatched client citations are rejected before model use", async () => {
  await withServer(async (baseUrl) => {
    const unknown = await fetch(`${baseUrl}/api/cross-examine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: "The pump was the sole cause of the outbreak [S01] [S99].",
        citedSourceIds: ["S01", "S99"]
      })
    });
    assert.equal(unknown.status, 422);

    const mismatch = await fetch(`${baseUrl}/api/cross-examine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: "The pump was the sole cause of the outbreak [S01] [S02].",
        citedSourceIds: ["S01", "S03"]
      })
    });
    assert.equal(mismatch.status, 422);

    const invalidSafetyIdentifier = await fetch(`${baseUrl}/api/cross-examine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: "The pump was the sole cause of the outbreak [S01] [S02].",
        citedSourceIds: ["S01", "S02"],
        safetyIdentifier: "student@example.com"
      })
    });
    assert.equal(invalidSafetyIdentifier.status, 422);
  });
});

test("the static app is served with security headers", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.match(html, /SourceCourt/);

    const metricsModule = await fetch(`${baseUrl}/metrics.mjs`);
    assert.equal(metricsModule.status, 200);
    assert.match(metricsModule.headers.get("content-type"), /^text\/javascript/);
    assert.match(await metricsModule.text(), /export function scoreArgument/);
  });
});

test("forwarding headers cannot bypass limits and independent browser sessions remain usable", async () => {
  const previous = process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY;
  try {
    await withServer(async (baseUrl) => {
      for (let index = 0; index < 20; index += 1) {
        assert.equal(await postValidChallenge(baseUrl, `198.51.100.${index + 1}`), 200);
      }
      assert.equal(await postValidChallenge(baseUrl, "203.0.113.200"), 429);
      assert.equal(
        await postValidChallenge(
          baseUrl,
          "203.0.113.200",
          "sc_independent_browser_session_1234"
        ),
        200
      );
    });
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
});

test("trusted proxy mode accepts only valid canonical IP values", async () => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "1";
  try {
    await withServer(async (baseUrl) => {
      for (let index = 0; index < 20; index += 1) {
        assert.equal(await postValidChallenge(baseUrl, "198.51.100.20"), 200);
      }
      assert.equal(await postValidChallenge(baseUrl, "198.51.100.20"), 429);
      assert.equal(await postValidChallenge(baseUrl, "203.0.113.20"), 200);
      assert.equal(await postValidChallenge(baseUrl, "not-an-ip"), 200);
    });
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
});
