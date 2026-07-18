import { CASE_FILE } from "./case-data.mjs";
import {
  extractCitationIds,
  fixtureCrossExamination,
  validateCrossExamination
} from "./validator.mjs";

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    challenge: { type: "string" },
    counterpoint: { type: "string" },
    next_question: { type: "string" },
    relation: {
      type: "string",
      enum: ["contradicts", "qualifies", "missing_link", "alternative_explanation"]
    },
    source_ids: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", enum: CASE_FILE.sources.map((source) => source.id) }
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    diagnostic_tags: {
      type: "array",
      maxItems: 3,
      items: {
        type: "string",
        enum: [
          "overclaim",
          "chronology",
          "causation",
          "selection_bias",
          "missing_counterevidence",
          "source_limit"
        ]
      }
    }
  },
  required: [
    "id",
    "challenge",
    "counterpoint",
    "next_question",
    "relation",
    "source_ids",
    "confidence",
    "diagnostic_tags"
  ]
};

function env(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function endpoint(pathname) {
  const base = env("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(/\/+$/, "");
  return `${base}/${pathname.replace(/^\/+/, "")}`;
}

function normalizeSafetyIdentifier(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^sc_[A-Za-z0-9_-]{20,80}$/.test(value)) {
    throw new Error("Safety identifier has an invalid format");
  }
  return value;
}

function promptFor({ claim, citedSourceIds }) {
  const record = CASE_FILE.sources.map((source) => ({
    id: source.id,
    title: source.title,
    kind: source.kind,
    stance: source.stance,
    summary: source.summary,
    excerpt: source.excerpt,
    limitation: source.limitation
  }));

  return {
    instructions: [
      "You are SourceCourt's opposing counsel in an evidence-reasoning lesson.",
      "Generate exactly one high-value cross-examination challenge to the learner's causal claim.",
      "Use only the supplied closed record. Every factual counterpoint must cite 1–3 exact source IDs from that record.",
      "Prefer the strongest weakness: overclaim, unresolved chronology, alternative explanation, missing counterevidence, or source limitation.",
      "Do not decide the historical case for the learner. Ask a question that makes the learner narrow, qualify, or better support the claim.",
      "Do not invent quotations, people, dates, or source IDs. Keep the challenge specific and suitable for a secondary-school learner.",
      "Return only the requested JSON object."
    ].join(" "),
    input: JSON.stringify(
      {
        case: {
          id: CASE_FILE.id,
          title: CASE_FILE.title,
          learning_goal: CASE_FILE.learningGoal
        },
        learner_claim: claim,
        learner_cited_source_ids: citedSourceIds,
        closed_record: record
      },
      null,
      2
    )
  };
}

function parseJsonText(value) {
  if (typeof value !== "string") throw new Error("Model returned no text");
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function providerToken(value) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return /^[A-Za-z0-9._:/-]{1,160}$/.test(token) ? token : null;
}

function responseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (content?.type === "refusal") throw new Error("Model refused the request");
        if (content?.type === "output_text" && typeof content.text === "string") return content.text;
      }
    }
  }
  if (typeof payload?.choices?.[0]?.message?.content === "string") {
    return payload.choices[0].message.content;
  }
  throw new Error("Model response contained no readable output");
}

async function postJson(url, body, timeoutMs) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 300) };
  }

  if (!response.ok) {
    const error = new Error(`Upstream returned HTTP ${response.status}`);
    error.status = response.status;
    error.upstreamCode = payload?.error?.code || "upstream_error";
    throw error;
  }
  return payload;
}

async function callResponses(prompt, settings) {
  const payload = await postJson(
    endpoint("responses"),
    {
      model: settings.model,
      store: false,
      ...(settings.safetyIdentifier
        ? { safety_identifier: settings.safetyIdentifier }
        : {}),
      reasoning: { effort: settings.reasoningEffort },
      max_output_tokens: 4096,
      instructions: prompt.instructions,
      input: prompt.input,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "sourcecourt_cross_examination",
          strict: true,
          schema: OUTPUT_SCHEMA
        }
      }
    },
    settings.timeoutMs
  );
  if (
    (typeof payload.status === "string" && payload.status !== "completed") ||
    payload.incomplete_details != null
  ) {
    const error = new Error("Upstream Responses request did not complete");
    error.code = "upstream_incomplete";
    throw error;
  }
  return {
    raw: parseJsonText(responseText(payload)),
    requestId: providerToken(payload.id),
    providerModel: providerToken(payload.model),
    providerReasoningEffort:
      providerToken(payload.reasoning?.effort),
    providerStatus: providerToken(payload.status),
    providerIncompleteDetails: payload.incomplete_details ?? null
  };
}

async function callChatCompletions(prompt, settings) {
  const payload = await postJson(
    endpoint("chat/completions"),
    {
      model: settings.model,
      ...(settings.safetyIdentifier
        ? { safety_identifier: settings.safetyIdentifier }
        : {}),
      messages: [
        { role: "system", content: prompt.instructions },
        {
          role: "user",
          content: `${prompt.input}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(OUTPUT_SCHEMA)}`
        }
      ],
      response_format: { type: "json_object" },
      reasoning_effort: settings.reasoningEffort,
      max_completion_tokens: 4096
    },
    settings.timeoutMs
  );
  return {
    raw: parseJsonText(responseText(payload)),
    requestId: providerToken(payload.id),
    providerModel: providerToken(payload.model),
    providerReasoningEffort:
      providerToken(payload.reasoning_effort) || providerToken(payload.reasoning?.effort),
    providerStatus: null,
    providerIncompleteDetails: null
  };
}

function modelMatches(requested, reported) {
  return reported === requested || reported.startsWith(`${requested}-`);
}

function verifyProviderConfiguration(result, settings) {
  const model = result.providerModel
    ? modelMatches(settings.model, result.providerModel)
      ? "matched"
      : "mismatched"
    : "not_reported";
  const reasoningEffort = result.providerReasoningEffort
    ? result.providerReasoningEffort === settings.reasoningEffort
      ? "matched"
      : "mismatched"
    : "not_reported";
  return {
    providerModel: result.providerModel,
    providerReasoningEffort: result.providerReasoningEffort,
    providerStatus: result.providerStatus,
    providerIncompleteDetails: result.providerIncompleteDetails,
    providerVerification: { model, reasoningEffort }
  };
}

function safeFailureCode(error) {
  if (error?.code === "upstream_incomplete") return "upstream_incomplete";
  if (error?.name === "TimeoutError") return "upstream_timeout";
  if (error?.status === 401 || error?.status === 403) return "upstream_auth";
  if (error?.status === 429) return "upstream_rate_limit";
  if (error?.status >= 500) return "upstream_unavailable";
  return "upstream_incompatible";
}

export function engineStatus() {
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const forceFixture = process.env.SOURCECOURT_FORCE_FIXTURE === "1";
  return {
    mode: hasKey && !forceFixture ? "live" : "fixture",
    model: env("OPENAI_MODEL", "gpt-5.6-sol"),
    reasoningEffort: env("OPENAI_REASONING_EFFORT", "max"),
    configured: hasKey
  };
}

export async function crossExamine({ claim, citedSourceIds, safetyIdentifier }) {
  const normalizedClaim = String(claim || "").replace(/\s+/g, " ").trim().slice(0, 1800);
  if (normalizedClaim.length < 24) throw new Error("Claim is too short to cross-examine");

  const validIds = new Set(CASE_FILE.sources.map((source) => source.id));
  const claimIds = extractCitationIds(normalizedClaim);
  const requestedIds = Array.isArray(citedSourceIds)
    ? citedSourceIds.map((id) => String(id).toUpperCase())
    : claimIds;
  const allIds = [...claimIds, ...requestedIds];
  if (allIds.some((id) => !validIds.has(id))) {
    throw new Error("Claim cites an unknown record source");
  }
  const normalizedIds = allIds.filter((id, index, values) => values.indexOf(id) === index);

  if (
    Array.isArray(citedSourceIds) &&
    (claimIds.length !== new Set(requestedIds).size || claimIds.some((id) => !requestedIds.includes(id)))
  ) {
    throw new Error("Claim markers and selected source IDs do not match");
  }

  if (normalizedIds.length < 2) throw new Error("Cite at least two record sources before cross-examination");
  const normalizedSafetyIdentifier = normalizeSafetyIdentifier(safetyIdentifier);

  const status = engineStatus();
  if (status.mode === "fixture") {
    return {
      challenge: fixtureCrossExamination(
        { claim: normalizedClaim, citedSourceIds: normalizedIds },
        CASE_FILE
      ),
      engine: { ...status, fallbackReason: "not_configured", latencyMs: 0, requestId: null }
    };
  }

  const configuredTimeout = Number(env("OPENAI_TIMEOUT_MS", "120000"));
  const settings = {
    model: status.model,
    reasoningEffort: status.reasoningEffort,
    safetyIdentifier: normalizedSafetyIdentifier,
    timeoutMs: Number.isFinite(configuredTimeout)
      ? Math.max(10_000, Math.min(120_000, configuredTimeout))
      : 120_000
  };
  const startedAt = performance.now();
  const prompt = promptFor({ claim: normalizedClaim, citedSourceIds: normalizedIds });
  let result;
  let route = "responses";

  try {
    result = await callResponses(prompt, settings);
  } catch (responsesError) {
    if (![400, 404, 405, 422].includes(responsesError?.status)) {
      return {
        challenge: fixtureCrossExamination(
          { claim: normalizedClaim, citedSourceIds: normalizedIds },
          CASE_FILE
        ),
        engine: {
          ...status,
          mode: "fixture",
          fallbackReason: safeFailureCode(responsesError),
          latencyMs: Math.round(performance.now() - startedAt),
          requestId: null
        }
      };
    }

    try {
      route = "chat_completions_compat";
      result = await callChatCompletions(prompt, settings);
    } catch (chatError) {
      return {
        challenge: fixtureCrossExamination(
          { claim: normalizedClaim, citedSourceIds: normalizedIds },
          CASE_FILE
        ),
        engine: {
          ...status,
          mode: "fixture",
          fallbackReason: safeFailureCode(chatError),
          latencyMs: Math.round(performance.now() - startedAt),
          requestId: null
        }
      };
    }
  }

  const provider = verifyProviderConfiguration(result, settings);
  if (
    provider.providerVerification.model === "mismatched" ||
    provider.providerVerification.reasoningEffort === "mismatched"
  ) {
    return {
      challenge: fixtureCrossExamination(
        { claim: normalizedClaim, citedSourceIds: normalizedIds },
        CASE_FILE
      ),
      engine: {
        ...status,
        mode: "fixture",
        fallbackReason: "upstream_configuration_mismatch",
        latencyMs: Math.round(performance.now() - startedAt),
        requestId: result.requestId,
        ...provider
      }
    };
  }

  let challenge;
  try {
    challenge = validateCrossExamination(result.raw, CASE_FILE);
  } catch {
    return {
      challenge: fixtureCrossExamination(
        { claim: normalizedClaim, citedSourceIds: normalizedIds },
        CASE_FILE
      ),
      engine: {
        ...status,
        mode: "fixture",
        fallbackReason: "invalid_model_output",
        latencyMs: Math.round(performance.now() - startedAt),
        requestId: result.requestId
      }
    };
  }

  return {
    challenge,
    engine: {
      ...status,
      route,
      latencyMs: Math.round(performance.now() - startedAt),
      requestId: result.requestId,
      ...provider
    }
  };
}
