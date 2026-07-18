# OpenAI Build Week 2026 submission draft

## Project

**Title:** SourceCourt — Defend the claim, not the guess  
**Track:** Education  
**Runtime model:** `gpt-5.6-sol`  
**Reasoning effort:** `max`

## One-line pitch

SourceCourt is a closed-world adversarial reasoning lab where students build a historical claim, GPT-5.6 mounts the strongest source-grounded challenge, and deterministic code audits provenance and revision state.

## Short description

Students often confuse fluent writing with supported reasoning, while many AI tutors simply produce a better answer for them. SourceCourt reverses that relationship. In a curated Broad Street cholera case, the learner selects evidence and makes a claim; GPT-5.6 acts only as opposing counsel and exposes one material weakness using the closed record. The learner must answer the counterevidence and revise the claim. Server-side validation rejects invented source IDs and reattaches every excerpt from local data, while deterministic metrics show changes in citation coverage and opposing-record response signals. The final artifact is a downloadable, auditable evidence brief—not an AI-written essay.

## What is technically distinctive

- GPT-5.6 performs the nontrivial semantic task: choose the strongest source-grounded challenge to the learner's exact claim.
- Responses API Structured Outputs define a strict schema; a compatibility route retains `max` reasoning effort where needed.
- A second server validator rejects any unknown or repeated source ID, illegal relation/tag, invalid confidence, missing field, or oversized text.
- Quotations and source links are server-owned and attached only after validation.
- The model is excluded from scoring. Three transparent metrics replay from local text and record markers.
- No-key, timeout, rate-limit, authentication, incompatible-output, and invalid-schema states preserve the learner's work and switch to a permanently labeled fixture.
- The zero-build Node application has no third-party runtime dependency, account, database, or browser-side secret.

## User impact

Target user: a secondary-school or early university student drafting a history argument. Target moment: the draft sounds confident but ignores contradictory evidence. SourceCourt makes the missing reasoning visible and requires the learner—not the model—to perform the repair.

The MVP demonstrates task-level improvement only. It does not claim to prove learning gains without a classroom study.

## Validation evidence

- One complete, keyboard-operable case with ten inspectable sources.
- Fixture judge path: surface record-use score `48 → 93`, evidence-facet coverage `33% → 83%`, opposing-record response signal `0% → 100%`.
- 32 deterministic tests currently pass.
- A strict live smoke and full browser replay passed with the Responses route, provider-reported `gpt-5.6-sol`, reasoning effort `max`, `completed` status, a request ID, and server-resolved provenance.
- A 155-second local H.264/AAC demo draft was assembled from the verified public live run with an English caption track; final narration review and public upload remain.
- Tests cover mixed valid/invented citations, invalid contracts, stable fixture replay, API behavior, security headers, and credential non-exposure.
- Known limitations are public: provenance can be verified by code, but semantic relevance remains an AI judgment and surface metrics can be gamed.

## How Codex was used

Codex supported the end-to-end build: competition and precedent research; concept selection; source-set design; product positioning; interaction and visual design; zero-dependency implementation; Structured Outputs integration; validation boundaries; deterministic evaluation; security review; browser automation; responsive and accessibility QA; and submission documentation.

GPT-5.6 has a separate in-product role: it runs the live, constrained cross-examination. Codex did not replace that runtime capability with a mock; the fixture is labeled as a fallback.

## Links to complete before submission

- **Live app:** [Open SourceCourt](https://sourcecourt.online/)
- **Public repository:** `[publish and verify]`
- **Demo video:** `[record and verify]`
- **Primary Codex /feedback session ID:** `[add after feedback submission]`

## Final checklist

- [x] Live app is public, free, and requires no account.
- [ ] A real GPT-5.6 `max` response is shown in the demo; fixture is not presented as live.
- [ ] Demo is under three minutes, public, audible, and captioned in English.
- [ ] Repository is public or judging access is tested; MIT license is visible.
- [ ] README judge path is replayed from a clean environment.
- [ ] `npm run check` passes from a clean checkout.
- [x] `npm run smoke:live` proves a completed Responses run with provider-reported `gpt-5.6-sol`, `max`, and a request ID.
- [ ] API key and private endpoint are absent from repository, video, download, and browser bundle.
- [ ] Item-level source provenance and host terms are reviewed.
- [ ] `/feedback` is submitted and the qualifying session ID is copied exactly.
- [ ] Eligibility, deadline, team membership, and prize-account allocation are reconfirmed against Official Rules.
