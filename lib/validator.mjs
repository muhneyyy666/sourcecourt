import { CASE_FILE } from "./case-data.mjs";
import {
  extractCitationIds,
  scoreArgument as scoreArgumentForCase,
  splitAssertions
} from "../public/metrics.mjs";

const ALLOWED_RELATIONS = new Set(["contradicts", "qualifies", "missing_link", "alternative_explanation"]);
const ALLOWED_TAGS = new Set(["overclaim", "chronology", "causation", "selection_bias", "missing_counterevidence", "source_limit"]);

export { extractCitationIds, splitAssertions };

export function scoreArgument(input = {}) {
  return scoreArgumentForCase({ ...input, caseFile: input.caseFile || CASE_FILE });
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string") throw new Error(`Model response omitted ${field}`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`Model response omitted ${field}`);
  if (normalized.length > maxLength) throw new Error(`Model response exceeded ${field} limit`);
  return normalized;
}

export function validateCrossExamination(raw, caseFile = CASE_FILE) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Model response was not an object");
  }
  const allowedKeys = new Set([
    "id",
    "challenge",
    "counterpoint",
    "next_question",
    "relation",
    "source_ids",
    "confidence",
    "diagnostic_tags"
  ]);
  if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
    throw new Error("Model response included an unexpected field");
  }

  const validIds = new Set(caseFile.sources.map((source) => source.id));
  const rawSourceIds = raw.source_ids;
  if (!Array.isArray(rawSourceIds) || rawSourceIds.length < 1 || rawSourceIds.length > 3) {
    throw new Error("Model response did not cite 1–3 valid sources");
  }
  if (rawSourceIds.some((id) => typeof id !== "string")) {
    throw new Error("Model response used an invalid source ID type");
  }
  const sourceIds = rawSourceIds.map((id) => id.toUpperCase());
  if (sourceIds.some((id) => !validIds.has(id))) {
    throw new Error("Model response cited an unknown source");
  }
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new Error("Model response repeated a source");
  }

  const relation = typeof raw.relation === "string" ? raw.relation.toLowerCase() : "";
  if (!ALLOWED_RELATIONS.has(relation)) throw new Error("Model response used an invalid relation");

  const id = requiredText(raw.id, "id", 80);
  const challenge = requiredText(raw.challenge, "challenge", 420);
  const counterpoint = requiredText(raw.counterpoint, "counterpoint", 520);
  const nextQuestion = requiredText(raw.next_question, "next_question", 280);

  if (
    typeof raw.confidence !== "number" ||
    !Number.isFinite(raw.confidence) ||
    raw.confidence < 0 ||
    raw.confidence > 1
  ) {
    throw new Error("Model response used an invalid confidence");
  }
  const confidence = raw.confidence;

  const rawTags = raw.diagnostic_tags;
  if (!Array.isArray(rawTags) || rawTags.length > 3) {
    throw new Error("Model response used invalid diagnostic tags");
  }
  if (rawTags.some((tag) => typeof tag !== "string")) {
    throw new Error("Model response used invalid diagnostic tags");
  }
  const diagnosticTags = rawTags.map((tag) => tag.toLowerCase());
  if (
    diagnosticTags.some((tag) => !ALLOWED_TAGS.has(tag)) ||
    new Set(diagnosticTags).size !== diagnosticTags.length
  ) {
    throw new Error("Model response used invalid diagnostic tags");
  }

  return {
    id,
    challenge,
    counterpoint,
    nextQuestion,
    relation,
    sourceIds,
    confidence,
    diagnosticTags,
    verifiedSources: sourceIds.map((id) => {
      const source = caseFile.sources.find((item) => item.id === id);
      return {
        id: source.id,
        title: source.title,
        excerpt: source.excerpt,
        limitation: source.limitation,
        url: source.url
      };
    })
  };
}

export function fixtureCrossExamination({ claim = "", citedSourceIds = [] } = {}, caseFile = CASE_FILE) {
  const absolute = /\b(sole|only|all|always|entirely|proves?)\b/i.test(claim);
  const cited = new Set(citedSourceIds);
  let raw;

  if (absolute) {
    raw = {
      id: "fixture-overclaim",
      challenge:
        "Your wording claims a sole cause, but the record does not isolate every competing condition or explain why the intervention followed the outbreak’s peak.",
      counterpoint:
        "The pump evidence is strong, yet chronology and environmental conditions make ‘sole cause’ more certain than the available record allows.",
      next_question:
        "How can you preserve the waterborne conclusion while narrowing what this case alone can establish?",
      relation: "qualifies",
      source_ids: ["S03", "S07"],
      confidence: 0.94,
      diagnostic_tags: ["overclaim", "chronology", "missing_counterevidence"]
    };
  } else if (!cited.has("S03")) {
    raw = {
      id: "fixture-timeline",
      challenge:
        "Your case does not yet address the timing of the pump-handle intervention.",
      counterpoint:
        "Mortality had already fallen before the handle was removed, so the intervention cannot function as a clean causal test by itself.",
      next_question:
        "Which independent exposure comparisons carry your argument when the intervention timing is ambiguous?",
      relation: "missing_link",
      source_ids: ["S03", "S04"],
      confidence: 0.9,
      diagnostic_tags: ["chronology", "causation"]
    };
  } else {
    raw = {
      id: "fixture-mechanism",
      challenge:
        "You have described a pattern, but your claim still needs a careful bridge from association to mechanism.",
      counterpoint:
        "Nearby sanitation failures offer a competing explanation unless exposure-specific comparisons and the contamination account are considered together.",
      next_question:
        "What combination of comparison and mechanism evidence makes water exposure more persuasive than proximity alone?",
      relation: "alternative_explanation",
      source_ids: ["S07", "S08"],
      confidence: 0.87,
      diagnostic_tags: ["causation", "source_limit"]
    };
  }

  return validateCrossExamination(raw, caseFile);
}
