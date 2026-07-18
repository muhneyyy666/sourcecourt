# SourceCourt judging evidence

This page gives judges one place to verify the submitted artifact without relying on promotional claims. The [official OpenAI Build Week criteria](https://openai.devpost.com/rules) are technological implementation, design, potential impact, and quality of the idea; all four are equally weighted, with technological implementation used first for tie-breaking.

**Last verification:** 2026-07-18T18:36:33Z

**Devpost:** [submitted public entry](https://devpost.com/software/sourcecourt-defend-the-claim-not-the-guess)

**Live app:** [sourcecourt.online](https://sourcecourt.online/)

**Video:** [2:35 public YouTube demo](https://youtu.be/Uaos8mr1Vug)

**Primary Codex `/feedback` session:** `019f73bb-c286-7b71-b596-5fd4c0959af1`

## Requirement and evidence matrix

| Requirement or judging signal | Checkable evidence | Boundary |
|---|---|---|
| Working Education project | The public app completes record selection, cross-examination, learner response, revision, sealing, and Markdown export without an account. | One hand-curated history case, not a general research engine. |
| Substantive Codex use | The dated repository begins with `0cb3a40` on July 18, 2026. The [Codex collaboration section](README.md#how-we-collaborated-with-codex) records implementation, test, security, accessibility, browser-replay, and deployment work, plus the entrant's retained decisions. | The `/feedback` ID identifies the primary build task; it is not a website route. |
| GPT-5.6 use | [`lib/ai.mjs`](lib/ai.mjs) sends a strict Responses-format request with configured model `gpt-5.6-sol`, reasoning effort `max`, and Structured Outputs. [`scripts/live-smoke.mjs`](scripts/live-smoke.mjs) rejects any run without provider-reported matching model and effort, completed status, a request ID, and valid source provenance. | Model and effort identity are provider-reported metadata, not a cryptographic attestation. Any mismatch or missing required proof becomes a labeled fixture. |
| Non-trivial technical implementation | The server rejects invented source IDs, illegal relations/tags, unexpected fields, invalid scalar types, oversized output, and insecure remote model URLs. It separates learner content from its instruction field and explicitly tells the model to treat learner and record fields as untrusted data. Displayed excerpts and links are reattached from local records. | Prompt instructions reduce injection risk but cannot prove semantic quality; provenance checks do not prove that the model selected the best historical interpretation. |
| Complete product design | The interface is keyboard-operable, responsive at 320–390 px widths, has visible live/fixture states, preserves work on provider failure, and exports a portable brief with warnings and source links. | Live `max` reasoning can take roughly 20–35 seconds; visible progress explains the wait. |
| Credible impact | SourceCourt targets a specific failure mode: a secondary-school or early-university draft that sounds fluent but ignores contradictory evidence. The model creates productive friction while the learner must write the response and revised claim. | The MVP demonstrates task-level workflow change, not classroom learning gains. |
| Public, testable repository | This repository is public, MIT licensed, has zero runtime dependencies, a deterministic fixture, setup instructions, and the command `npm run check`. | A live model run needs a separately supplied server-side API key. |
| Required media and submission data | Devpost shows `Submitted` and `5/5 steps done`. Additional info records Individual, United Kingdom, Education, the repository, test instructions, the `/feedback` ID, and `SourceCourt-Judge-Packet.pdf`. | Additional info is visible only to the entrant, organizers, and judges. |

## Reproducible checks

```bash
npm run check
npm run smoke:public
```

At submission verification, `npm run check` passed all 32 deterministic tests. The public smoke confirmed:

- apex HTTPS returned `200` with HSTS, CSP, frame denial, MIME-sniffing protection, referrer policy, and permissions policy;
- `www` returned `308` to the canonical apex;
- `/api/health` returned `status=ok`, `mode=live`, configured model `gpt-5.6-sol`, reasoning effort `max`, and `configured=true`;
- anonymous Git remote `HEAD` matched local commit `04bf3e1f7d5836b6edd36c6aa65388f9543a139e`;
- anonymous YouTube metadata returned the submitted title and SourceCourt channel.

`npm run smoke:live` is intentionally separate because it spends one live model request. It passes only when the Responses route completes and the provider reports the requested model and reasoning effort.

## Build trail

| Commit | Local time (UTC+8) | Evidence added |
|---|---|---|
| `0cb3a40` | 2026-07-18 17:14 | Working evidence-reasoning MVP |
| `65a88d0` | 2026-07-18 18:37 | Verified submission state |
| `57fdcdd` | 2026-07-18 18:40 | Codex collaboration and decision boundaries |
| `9c5d394` | 2026-07-18 23:44 | Judge path and submission copy |
| `ac78625` | 2026-07-18 23:59 | Verified public demo video |
| `04bf3e1` | 2026-07-19 02:22 | Qualifying `/feedback` session ID |

Use `git show <commit>` to inspect any stage. The current repository may contain later documentation, security, or reliability refinements made before the submission deadline; these do not replace the submitted product concept or demo path.

## Artifact map

- [`README.md`](README.md) — 90-second judge path, architecture, Codex collaboration, model boundary, tests, privacy, and limitations
- [`lib/ai.mjs`](lib/ai.mjs) — GPT-5.6 request contract, prompt/data boundary, provider verification, and safe fallback
- [`lib/validator.mjs`](lib/validator.mjs) — second validation boundary and deterministic fixture
- [`public/metrics.mjs`](public/metrics.mjs) — shared transparent audit formulas
- [`test/`](test/) — deterministic contract, provenance, server, security, and metric tests
- [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md) — item-level historical-source notes and limitations
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — release gate, network boundary, and judging-period operations
- [`SUBMISSION.md`](SUBMISSION.md) — submitted copy, links, identifier, and completion record

## Operational commitment

The public app, repository, and video must remain free and available through the judging period. The current deployment has a single persistent origin behind Cloudflare and Tailscale Funnel, so availability depends on that service staying powered, connected, and funded. `npm run smoke:public` provides a no-model-cost availability check; any failed check should be treated as a release blocker.
