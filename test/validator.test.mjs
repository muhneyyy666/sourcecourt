import test from "node:test";
import assert from "node:assert/strict";
import { CASE_FILE } from "../lib/case-data.mjs";
import {
  extractCitationIds,
  fixtureCrossExamination,
  scoreArgument,
  splitAssertions,
  validateCrossExamination
} from "../lib/validator.mjs";
import { scoreArgument as scoreBrowserArgument } from "../public/metrics.mjs";

test("extractCitationIds normalizes and deduplicates record markers", () => {
  assert.deepEqual(extractCitationIds("First [s01], again [S01], then [S07]."), ["S01", "S07"]);
});

test("splitAssertions preserves citation-bearing sentences", () => {
  assert.deepEqual(splitAssertions("One material claim [S01]. Another developed claim [S02]; Tiny."), [
    "One material claim [S01].",
    "Another developed claim [S02]"
  ]);
});

test("short developed assertions are not silently discarded", () => {
  const assertions = splitAssertions("The mapped cluster is relevant [S01]. It was air.");
  assert.deepEqual(assertions, ["The mapped cluster is relevant [S01].", "It was air."]);
  const score = scoreArgument({ claim: "The mapped cluster is relevant [S01]. It was air." });
  assert.equal(score.assertionCount, 2);
  assert.equal(score.uncitedAssertionRate, 50);
});

test("an uncited opening claim starts with a 100 percent uncited rate", () => {
  const score = scoreArgument({ claim: CASE_FILE.starterClaim });
  assert.equal(score.uncitedAssertionRate, 100);
  assert.equal(score.evidenceCoverage, 0);
  assert.equal(score.counterevidenceAddressed, 0);
});

test("valid record markers produce deterministic evidence coverage", () => {
  const input = {
    claim: "Pump-water exposure is strongly associated with the local outbreak [S01] [S02] [S04] [S08]."
  };
  const first = scoreArgument(input);
  const replay = scoreArgument(input);
  assert.deepEqual(first, replay);
  assert.equal(first.uncitedAssertionRate, 0);
  assert.ok(first.evidenceCoverage >= 50);
  assert.equal(first.citedSourceCount, 4);
});

test("unknown record markers are reported and do not count as support", () => {
  const score = scoreArgument({ claim: "This sentence relies on an invented record [S99]." });
  assert.deepEqual(score.invalidCitationIds, ["S99"]);
  assert.equal(score.uncitedAssertionRate, 100);
});

test("unknown response markers are reported independently", () => {
  const challenge = fixtureCrossExamination({
    claim: CASE_FILE.starterClaim,
    citedSourceIds: ["S01", "S02"]
  });
  const score = scoreArgument({
    claim: "Pump-water exposure was an important cause [S01] [S02].",
    response: "This developed reply cites the challenged record [S03] and also invents one [S99].",
    challenge
  });
  assert.deepEqual(score.invalidResponseCitationIds, ["S99"]);
});

test("counterevidence requires a developed response citing the challenged record", () => {
  const challenge = fixtureCrossExamination({
    claim: CASE_FILE.starterClaim,
    citedSourceIds: ["S01", "S02"]
  });
  const weak = scoreArgument({
    claim: "Pump-water exposure was an important cause [S01] [S02].",
    response: "I disagree.",
    challenge
  });
  const strong = scoreArgument({
    claim: "Pump-water exposure was an important cause [S01] [S02].",
    response:
      "The declining curve limits what handle removal can prove [S03], so I rely instead on exposure-specific comparisons and narrow the intervention claim.",
    challenge
  });
  assert.equal(weak.counterevidenceAddressed, 0);
  assert.equal(strong.counterevidenceAddressed, 100);
});

test("response length alone cannot earn an opposing-record signal", () => {
  const challenge = fixtureCrossExamination({
    claim: CASE_FILE.starterClaim,
    citedSourceIds: ["S01", "S02"]
  });
  const longButUncited = scoreArgument({
    claim: "Pump-water exposure was an important cause [S01] [S02].",
    response:
      "This deliberately long response contains many words but never identifies or cites the record selected by opposing counsel in its challenge.",
    challenge
  });
  const shortButLinked = scoreArgument({
    claim: "Pump-water exposure was an important cause [S01] [S02].",
    response: "The intervention chronology limits that inference and requires caution here [S03].",
    challenge
  });
  assert.equal(longButUncited.counterevidenceAddressed, 0);
  assert.equal(shortButLinked.counterevidenceAddressed, 50);
});

test("browser and server use one metrics implementation", () => {
  const input = {
    claim: "Pump-water exposure was an important cause [S01] [S02].",
    response:
      "The declining curve limits what handle removal can prove [S03], so the claim must rely on exposure comparisons and remain qualified.",
    challenge: fixtureCrossExamination({
      claim: CASE_FILE.starterClaim,
      citedSourceIds: ["S01", "S02"]
    })
  };
  assert.deepEqual(scoreArgument(input), scoreBrowserArgument({ ...input, caseFile: CASE_FILE }));
  assert.equal(scoreArgument(input).semanticSupportAssessed, false);
});

test("valid model output is enriched with server-owned excerpts", () => {
  const result = validateCrossExamination({
    id: "challenge-test",
    challenge: "The intervention chronology limits the causal claim.",
    counterpoint: "Mortality was already declining before the handle was removed.",
    next_question: "Which independent comparisons can carry the argument?",
    relation: "qualifies",
    source_ids: ["S03", "S04"],
    confidence: 0.9,
    diagnostic_tags: ["chronology", "causation"]
  });
  assert.deepEqual(result.sourceIds, ["S03", "S04"]);
  assert.equal(result.verifiedSources[0].excerpt, CASE_FILE.sources[2].excerpt);
});

test("model output with only an unknown source is rejected", () => {
  assert.throws(
    () =>
      validateCrossExamination({
        id: "challenge-bad-id",
        challenge: "This looks plausible but has no record.",
        counterpoint: "The model attempted to cite an invented source.",
        next_question: "Can the claim be tested against a real source?",
        relation: "missing_link",
        source_ids: ["S99"],
        confidence: 0.4,
        diagnostic_tags: ["source_limit"]
      }),
    /unknown source/
  );
});

test("model output mixing a valid and invented source is rejected as a whole", () => {
  assert.throws(
    () =>
      validateCrossExamination({
        id: "challenge-mixed-id",
        challenge: "One citation exists, but another was invented.",
        counterpoint: "Partial provenance must not make the complete output look verified.",
        next_question: "Can every cited source be resolved inside the record?",
        relation: "qualifies",
        source_ids: ["S03", "S99"],
        confidence: 0.4,
        diagnostic_tags: ["source_limit"]
      }),
    /unknown source/
  );
});

test("overlong model text is rejected rather than silently truncated", () => {
  assert.throws(
    () =>
      validateCrossExamination({
        id: "challenge-too-long",
        challenge: "x".repeat(421),
        counterpoint: "The response must stay inside an auditable display boundary.",
        next_question: "Can the challenge be stated precisely?",
        relation: "qualifies",
        source_ids: ["S03"],
        confidence: 0.5,
        diagnostic_tags: ["source_limit"]
      }),
    /challenge limit/
  );
});

test("invalid confidence and diagnostic tags are rejected", () => {
  const base = {
    id: "challenge-bounds",
    challenge: "The output must remain within its declared contract.",
    counterpoint: "Clamping invalid values would conceal a schema failure.",
    next_question: "Should this response be accepted?",
    relation: "qualifies",
    source_ids: ["S03"],
    confidence: 1.4,
    diagnostic_tags: ["source_limit"]
  };
  assert.throws(() => validateCrossExamination(base), /invalid confidence/);
  assert.throws(
    () => validateCrossExamination({ ...base, confidence: 0.5, diagnostic_tags: ["truth_verdict"] }),
    /invalid diagnostic tags/
  );
});

test("model output rejects coerced scalar types and unexpected fields", () => {
  const valid = {
    id: "challenge-strict-types",
    challenge: "The response must preserve strict runtime types.",
    counterpoint: "JSON-compatible coercion would conceal an invalid model contract.",
    next_question: "Does every value match the declared schema?",
    relation: "qualifies",
    source_ids: ["S03"],
    confidence: 0.5,
    diagnostic_tags: ["source_limit"]
  };
  for (const confidence of [null, "0.5", true]) {
    assert.throws(() => validateCrossExamination({ ...valid, confidence }), /invalid confidence/);
  }
  assert.throws(
    () => validateCrossExamination({ ...valid, source_ids: [3] }),
    /source ID type/
  );
  assert.throws(
    () => validateCrossExamination({ ...valid, diagnostic_tags: [1] }),
    /invalid diagnostic tags/
  );
  assert.throws(
    () => validateCrossExamination({ ...valid, explanation: "extra" }),
    /unexpected field/
  );
});

test("model output with an unsupported relation is rejected", () => {
  assert.throws(
    () =>
      validateCrossExamination({
        id: "challenge-bad-relation",
        challenge: "The model attempted to pronounce a verdict.",
        counterpoint: "The product permits challenges, not truth judgments.",
        next_question: "How should the claim be narrowed?",
        relation: "definitely_false",
        source_ids: ["S03"],
        confidence: 0.5,
        diagnostic_tags: []
      }),
    /invalid relation/
  );
});

test("the overclaim fixture is stable and visibly source-bound", () => {
  const first = fixtureCrossExamination({
    claim: CASE_FILE.starterClaim,
    citedSourceIds: ["S01", "S02"]
  });
  const replay = fixtureCrossExamination({
    claim: CASE_FILE.starterClaim,
    citedSourceIds: ["S01", "S02"]
  });
  assert.equal(first.id, "fixture-overclaim");
  assert.deepEqual(first, replay);
  assert.deepEqual(first.sourceIds, ["S03", "S07"]);
});
