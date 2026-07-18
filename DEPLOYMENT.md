# SourceCourt deployment runbook

This runbook separates local model verification from public release so a fixture can never be mistaken for a successful live integration.

**Current public deployment:** [SourceCourt live app](https://sourcecourt.online/) · [health check](https://sourcecourt.online/api/health)

The reviewed deployment runs as a persistent user service bound to loopback and exposes only the app through a Tailscale Funnel origin. A Cloudflare Worker on the Free plan serves `sourcecourt.online`, redirects every HTTP and `www` request to the canonical HTTPS apex domain, emits a one-year HSTS policy, and reverse-proxies requests to that origin. Its separate pre-existing HTTPS `443` route remains unchanged. Loopback binding is intentional for this topology; a container or conventional PaaS should instead use `HOST=0.0.0.0`.

The custom domain and Worker do not replace the origin server. If the server, user service, or Funnel stops, `sourcecourt.online` will return an upstream failure. Keep the server active through judging, and treat the exact origin URL as private infrastructure rather than a public submission link.

## 1. Release gate

Run from a clean checkout with Node.js 22 or newer:

```bash
npm run check
npm run smoke:live
```

The second command must end with `Live smoke PASS` and report all of the following without printing the API key or Base URL:

- requested model `gpt-5.6-sol` and a matching provider-reported model or dated snapshot
- provider-reported reasoning effort `max`
- route `responses`, status `completed`, no incomplete details, and an upstream request ID
- one or more verified source IDs

Any fixture result, authentication error, timeout, incompatible response, or invalid model contract fails this gate.

## 2. Public service configuration

Use a Node web-service runtime with this start command:

```bash
npm start
```

Set these server-only environment variables in the hosting provider's secret manager:

```dotenv
OPENAI_API_KEY=...
OPENAI_BASE_URL=...
OPENAI_MODEL=gpt-5.6-sol
OPENAI_REASONING_EFFORT=max
OPENAI_TIMEOUT_MS=120000
HOST=0.0.0.0
PORT=<provider-assigned-port>
TRUST_PROXY=0
```

Do not upload `.env.local`, paste secrets into build logs, or prefix these variables with a browser-public namespace. The service must inject its assigned `PORT`; SourceCourt binds to `HOST` and `PORT` at runtime.

Set `TRUST_PROXY=1` only after confirming that the hosting edge removes client-supplied forwarding headers and writes a canonical `X-Forwarded-For` value. Otherwise leave it at `0`; the server will use the socket address. The in-process limiter is bounded and suitable as a last local guard, but a public live deployment should also enable the provider's edge or shared rate limit because multiple service instances do not share memory.

The public ingress and application platform must allow an end-to-end request duration of at least 130 seconds. SourceCourt gives a `max` reasoning call up to 120 seconds; a shorter 30–100 second proxy timeout can disconnect the browser before the server returns either the live result or its explicit fixture fallback. If the platform cannot provide this window, use a platform with longer request support or move the model call to an asynchronous job before recording the final demo.

## 3. Network reachability gate

The deployed server—not the learner's browser—must be able to reach `OPENAI_BASE_URL`. A gateway available only on a private network will not normally be reachable from a public hosting provider. Before deployment, choose one of these reviewed arrangements:

1. use a public HTTPS OpenAI-compatible endpoint with server-side authentication;
2. connect the hosting runtime to the private network using an approved tunnel or private-network agent; or
3. host SourceCourt inside the same reachable network and expose only the SourceCourt web service through a reviewed HTTPS ingress.

Never expose the upstream API key or proxy endpoint to browser code. Treat any public tunnel as an external state and security change requiring an explicit review before activation.

## 4. Post-deployment verification

From a clean browser session:

1. load [the deployed `/api/health` endpoint](https://sourcecourt.online/api/health) and confirm the server is configured for model `gpt-5.6-sol` and reasoning effort `max`;
2. replay the README judge path and confirm the top badge changes from configured to live after cross-examination;
3. inspect the challenge note and confirm the provider-reported model matched, reasoning effort is `max`, and status is `completed`;
4. verify the exported brief records request configuration, provider verification state, live route, latency, verified source IDs, excerpts, and links;
5. inspect browser developer tools to confirm no key or upstream Base URL appears in HTML, JavaScript, storage, or network responses;
6. test the public URL without an account on desktop and mobile, and confirm HTTP and `www` redirect directly to `https://sourcecourt.online/` while HTTPS includes `Strict-Transport-Security`;
7. rerun the path once after a cold start to catch missing persistent configuration.
8. exercise the slowest live call and confirm the hosting edge does not time out before the 120-second application limit.

If any step falls back to fixture, do not record the final demo until the upstream failure is resolved.

## 5. Submission closure

After the public URL passes:

- publish the reviewed repository with `.env.local` absent;
- record a captioned demo under three minutes showing the live badge and evidence brief;
- run `/feedback` from the qualifying Codex task and copy the returned session ID exactly;
- replace all remaining placeholders in `SUBMISSION.md`;
- reconfirm the deadline, eligibility, team membership, and prize-account allocation against the official rules.
