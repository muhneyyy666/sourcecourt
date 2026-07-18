# SourceCourt — 2:35 demo script

Target: `2:25–2:40`, English narration, live GPT-5.6 path, no terminal or secret visible.

## Recording setup

- Record from the verified [public SourceCourt app](https://sourcecourt.online/), not a localhost or fixture URL.
- Use a clean browser profile at 1440 × 900 and disable notifications.
- Run `npm run smoke:live` off camera immediately before recording. Do not proceed unless it passes the strict Responses/provider gate.
- Start with the amber `Configured · gpt-5.6-sol · max` badge; after cross-examination, confirm it changes to green `Live` with the provider-reported model.
- Keep a fixture recording only as recovery footage; never present it as a live response.
- Pre-copy the two learner sentences below. The learner must still perform the revision on screen.
- Keep the source IDs, engine badge, and audit visible during the relevant claims.

## Timeline and narration

### 0:00–0:12 — Cold open

**Picture:** Start on the sealed brief, showing `48 → 93`, then cut to the opening claim.

**Narration:**

> Fluent is not the same as supported. SourceCourt makes students defend a claim with evidence instead of asking AI to write it.

### 0:12–0:30 — The closed record

**Action:** Open `S01`, point to the excerpt and limitation, close it, then cite `S01` and `S02`.

**Narration:**

> This seven-minute history case contains ten curated sources. The student chooses the evidence, and every marker remains inspectable against the original record.

### 0:30–0:58 — Real cross-examination

**Action:** Select **Cross-examine my claim**. Keep the loading state and engine badge on screen. Show the returned challenge and verified source excerpts.

**Narration:**

> GPT-5.6 is opposing counsel, not the answer writer. At maximum reasoning effort, it finds one material weakness using only the closed record. Here it catches a familiar historical overclaim: the outbreak was already declining before the handle was removed.

### 0:58–1:18 — Trust boundary

**Action:** Point to the engine note—Responses API, completed status, matching provider model and max effort—and the attached `S03`/`S07` excerpts.

**Narration:**

> The model returns strict JSON. Server code rejects unknown source IDs, illegal relations, missing fields, and overlong output, then attaches quotations from local data. Code verifies provenance; semantic relevance remains an AI judgment and may be wrong.

### 1:18–1:54 — Learner revises

**Action:** Paste the prepared response:

> The decline before handle removal limits the intervention as proof [S03]. I therefore treat it as precautionary and rely on independent exposure comparisons rather than a sole-cause claim.

Then paste the revised claim:

> Spatial clustering, household interviews, and natural comparisons strongly support Broad Street pump water as a major transmission route in the Soho outbreak, while the intervention timing does not establish a sole cause [S01] [S02] [S03] [S04].

**Narration:**

> The student must acknowledge the opposing evidence and narrow the claim. SourceCourt never generates the final argument for them.

### 1:54–2:15 — Measurable state change

**Action:** Seal the brief and hold on the four deltas.

**Narration:**

> Deterministic checks now show broader evidence-facet coverage, a developed response that cites the opposing record, and no uncited assertion. The surface record-use score moves from 48 to 93. These signals can be gamed; they are not semantic grading, a truth score, or a claim of learning outcomes.

### 2:15–2:28 — Portable result

**Action:** Download the Markdown evidence brief and briefly show its source list and warning.

**Narration:**

> The result is a portable evidence brief with the claim, challenge, learner response, revision, timestamp, metrics, and original sources.

### 2:28–2:35 — Close

**Picture:** Return to the sealed brief and SourceCourt mark.

**Narration:**

> SourceCourt: the student owns the conclusion; AI makes the reasoning harder to fake.

## Recording verification

- Duration below three minutes with five seconds of safety margin.
- Engine badge, real latency, Responses route, completed status, matching provider model, and max effort are legible.
- No API key, `.env`, personal path, bookmarks, or notifications appear.
- Captions do not obscure source IDs or metric deltas.
- Audio and captions are checked in an incognito window.
- Downloaded file opens, contains the provider status/request ID, and contains no secret or unexpected model content.

## Local review draft

The current verified live recording can be assembled into an exact 2:35 H.264/AAC review draft with an embedded English caption track:

```bash
scripts/build-demo-draft.sh
```

See [`demo/README.md`](demo/README.md) for the local artifact paths and final narration handoff. The generated system voice is a review placeholder, not an automatic decision to publish that voice.
