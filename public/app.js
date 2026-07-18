import { extractCitationIds, scoreArgument } from "./metrics.mjs";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function sessionSafetyIdentifier() {
  const key = "sourcecourt.safety-session.v1";
  try {
    const existing = sessionStorage.getItem(key);
    if (/^sc_[A-Za-z0-9_-]{20,80}$/.test(existing || "")) return existing;
  } catch {
    // Storage can be unavailable in restrictive browser modes; the in-memory ID still works.
  }
  const identifier = `sc_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    sessionStorage.setItem(key, identifier);
  } catch {
    // Keep the generated in-memory value for this page lifecycle.
  }
  return identifier;
}

const state = {
  caseFile: null,
  engine: null,
  selected: new Set(),
  claim: "",
  response: "",
  revision: "",
  challenge: null,
  challengeEngine: null,
  beforeMetrics: null,
  finalMetrics: null,
  stage: 1,
  loading: false,
  activeDialogSource: null,
  safetyIdentifier: sessionSafetyIdentifier()
};

const elements = {
  engineBadge: $("#engine-badge"),
  engineLabel: $("#engine-label"),
  sourceList: $("#source-list"),
  recordCounter: $("#record-counter"),
  claimInput: $("#claim-input"),
  claimStatus: $("#claim-status"),
  challengeButton: $("#challenge-button"),
  resetButton: $("#reset-button"),
  challengeSection: $("#challenge-section"),
  challengeText: $("#challenge-text"),
  counterpointText: $("#counterpoint-text"),
  nextQuestionText: $("#next-question-text"),
  relationChip: $("#relation-chip"),
  verifiedSources: $("#verified-sources"),
  challengeEngineNote: $("#challenge-engine-note"),
  responseInput: $("#response-input"),
  revisionInput: $("#revision-input"),
  revisionStatus: $("#revision-status"),
  sealButton: $("#seal-button"),
  sealedBrief: $("#sealed-brief"),
  briefBefore: $("#brief-before"),
  briefAfter: $("#brief-after"),
  briefDeltas: $("#brief-deltas"),
  returnButton: $("#return-button"),
  downloadButton: $("#download-button"),
  readinessScore: $("#readiness-score"),
  uncitedValue: $("#uncited-value"),
  uncitedProgress: $("#uncited-progress"),
  coverageValue: $("#coverage-value"),
  coverageProgress: $("#coverage-progress"),
  counterValue: $("#counter-value"),
  counterProgress: $("#counter-progress"),
  facetList: $("#facet-list"),
  threadLayer: $("#thread-layer"),
  threadPaths: $("#thread-paths"),
  sourceDialog: $("#source-dialog"),
  dialogCite: $("#dialog-cite"),
  toast: $("#toast")
};

let toastTimer;
let threadFrame;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function calculateMetrics(claim = state.claim, response = state.response, challenge = state.challenge) {
  return scoreArgument({ claim, response, challenge, caseFile: state.caseFile });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 3400);
}

function setStatus(element, message, tone = "neutral") {
  element.textContent = message;
  element.classList.toggle("is-ready", tone === "ready");
  element.classList.toggle("is-error", tone === "error");
}

function setStage(stage) {
  state.stage = stage;
  $$(".stage-rail li").forEach((item) => {
    const itemStage = Number(item.dataset.stage);
    item.classList.toggle("is-active", itemStage === stage);
    item.classList.toggle("is-complete", itemStage < stage);
    if (itemStage === stage) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
    const number = item.querySelector(":scope > span");
    number.textContent = itemStage < stage ? "✓" : String(itemStage).padStart(2, "0");
  });
}

function populateCaseHeader() {
  const caseFile = state.caseFile;
  $("#header-case-id").textContent = caseFile.id;
  $("#case-eyebrow").textContent = caseFile.eyebrow;
  $("#case-title").textContent = caseFile.title;
  $("#case-subtitle").textContent = caseFile.subtitle;
  $("#case-background").textContent = caseFile.background;
  $("#source-count").textContent = `${caseFile.sources.length} sources`;
  $("#case-location").textContent = caseFile.location;
  $("#case-reading-time").textContent = caseFile.readingTime;
}

function renderEngine() {
  const engine = state.engine;
  const verifiedLive = engine?.mode === "live" && Boolean(engine.route);
  elements.engineBadge.classList.toggle("is-live", verifiedLive);
  elements.engineBadge.classList.toggle("is-fixture", engine?.mode !== "live");
  if (engine?.mode === "live") {
    const stateLabel = engine.route ? "Live" : "Configured";
    const modelLabel = engine.providerVerification?.model === "matched" ? engine.providerModel : engine.model;
    elements.engineLabel.textContent = `${stateLabel} · ${modelLabel} · ${engine.reasoningEffort}`;
  } else {
    elements.engineLabel.textContent = "Fixture · offline ready";
  }
}

function renderSources() {
  const cards = state.caseFile.sources.map((source) => {
    const selected = state.selected.has(source.id);
    const role = source.stance === "complicates" ? "complicating record" : "supporting record";
    return `
      <article class="source-card${selected ? " is-cited" : ""}" data-source-id="${source.id}" data-stance="${source.stance}">
        <span class="source-id">${source.id}</span>
        <div>
          <h3>${escapeHtml(source.title)}</h3>
          <p>${escapeHtml(source.kind)} · ${escapeHtml(source.date)} · ${role}</p>
        </div>
        <div class="source-actions">
          <button class="icon-button inspect-button" type="button" data-action="inspect" data-source-id="${source.id}" aria-label="Inspect ${escapeHtml(source.title)}">···</button>
          <button class="icon-button cite-button" type="button" data-action="cite" data-source-id="${source.id}" aria-pressed="${selected}" aria-label="${selected ? "Remove" : "Cite"} ${source.id}">${selected ? "✓" : "+"}</button>
        </div>
      </article>`;
  });
  elements.sourceList.innerHTML = cards.join("");
  elements.recordCounter.textContent = `${state.selected.size} / ${state.caseFile.sources.length} cited`;
  scheduleThreads();
}

function renderFacets(metrics) {
  const covered = new Set(metrics.coveredFacets);
  elements.facetList.innerHTML = state.caseFile.facets
    .map(
      (facet) =>
        `<li class="${covered.has(facet.id) ? "is-covered" : ""}">${escapeHtml(facet.label)}</li>`
    )
    .join("");
}

function renderMetrics(metrics = calculateMetrics()) {
  elements.readinessScore.textContent = String(metrics.readiness);
  elements.readinessScore.setAttribute("aria-label", `Record-use score ${metrics.readiness} out of 100`);
  elements.uncitedValue.textContent = `${metrics.uncitedAssertionRate}%`;
  elements.uncitedProgress.value = metrics.uncitedAssertionRate;
  elements.uncitedProgress.textContent = `${metrics.uncitedAssertionRate}%`;
  elements.coverageValue.textContent = `${metrics.evidenceCoverage}%`;
  elements.coverageProgress.value = metrics.evidenceCoverage;
  elements.coverageProgress.textContent = `${metrics.evidenceCoverage}%`;
  elements.counterValue.textContent = `${metrics.counterevidenceAddressed}%`;
  elements.counterProgress.value = metrics.counterevidenceAddressed;
  elements.counterProgress.textContent = `${metrics.counterevidenceAddressed}%`;
  renderFacets(metrics);
  return metrics;
}

function renderClaimState() {
  const metrics = renderMetrics();
  const citations = extractCitationIds(state.claim);
  const valid = new Set(state.caseFile.sources.map((source) => source.id));
  const invalid = citations.filter((id) => !valid.has(id));
  state.selected = new Set(citations.filter((id) => valid.has(id)));
  elements.challengeButton.disabled = state.loading || state.selected.size < 2 || state.claim.trim().length < 24;

  if (invalid.length) {
    setStatus(elements.claimStatus, `Unknown record marker: ${invalid.join(", ")}. Use only S01–S10.`, "error");
  } else if (state.selected.size < 2) {
    setStatus(
      elements.claimStatus,
      `Cite ${2 - state.selected.size} more source${state.selected.size === 1 ? "" : "s"} to open cross-examination.`
    );
  } else if (metrics.uncitedAssertionRate > 0) {
    setStatus(elements.claimStatus, "The record is attached, but at least one assertion still lacks a marker.");
  } else {
    setStatus(elements.claimStatus, `${state.selected.size} sources attached. The opposing bench is ready.`, "ready");
  }
  if (state.stage < 3) setStage(state.selected.size ? 2 : 1);
  elements.recordCounter.textContent = `${state.selected.size} / ${state.caseFile.sources.length} cited`;
  scheduleThreads();
}

function insertCitation(sourceId) {
  const token = `[${sourceId}]`;
  const hasCitation = new RegExp(`\\[${sourceId}\\]`, "i").test(state.claim);
  if (hasCitation) {
    state.claim = state.claim
      .replace(new RegExp(`\\s*\\[${sourceId}\\]`, "gi"), "")
      .replace(/\s+([.!?,;:])/g, "$1")
      .trim();
    state.selected.delete(sourceId);
    showToast(`${sourceId} removed from the claim.`);
  } else {
    const trimmed = state.claim.trim();
    const punctuation = /[.!?]$/.test(trimmed);
    state.claim = punctuation ? `${trimmed.slice(0, -1)} ${token}${trimmed.slice(-1)}` : `${trimmed} ${token}`;
    state.selected.add(sourceId);
    showToast(`${sourceId} attached to the claim.`);
  }
  elements.claimInput.value = state.claim;
  renderSources();
  renderClaimState();
}

function openSource(sourceId) {
  const source = state.caseFile.sources.find((item) => item.id === sourceId);
  if (!source) return;
  state.activeDialogSource = source.id;
  $("#dialog-kind").textContent = `${source.id} · ${source.kind}`;
  $("#dialog-title").textContent = source.title;
  $("#dialog-author").textContent = source.author;
  $("#dialog-date").textContent = source.date;
  $("#dialog-summary").textContent = source.summary;
  $("#dialog-excerpt").textContent = `“${source.excerpt}”`;
  $("#dialog-limitation").textContent = source.limitation;
  $("#dialog-link").href = source.url;
  elements.dialogCite.textContent = state.selected.has(source.id) ? "Remove this citation" : "Cite this source";
  elements.sourceDialog.showModal();
}

function renderChallenge() {
  const challenge = state.challenge;
  elements.challengeSection.hidden = false;
  elements.challengeText.textContent = challenge.challenge;
  elements.counterpointText.textContent = challenge.counterpoint;
  elements.nextQuestionText.textContent = challenge.nextQuestion;
  elements.relationChip.textContent = challenge.relation.replaceAll("_", " ");
  elements.verifiedSources.innerHTML = challenge.verifiedSources
    .map(
      (source) => `
        <article class="verified-source">
          <strong>${source.id} · ${escapeHtml(source.title)}</strong>
          <q>${escapeHtml(source.excerpt)}</q>
          <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">Open record ↗</a>
        </article>`
    )
    .join("");

  const engine = state.challengeEngine;
  if (engine.mode === "live") {
    const route = engine.route === "chat_completions_compat" ? "compatibility route" : "Responses API";
    const completionProof =
      engine.providerStatus === "completed" ? "completed" : "completion status not reported";
    const modelProof =
      engine.providerVerification?.model === "matched"
        ? `provider model ${engine.providerModel} matched`
        : "provider did not report model metadata";
    const effortProof =
      engine.providerVerification?.reasoningEffort === "matched"
        ? "provider reported max effort"
        : "max effort requested; provider did not echo it";
    elements.challengeEngineNote.textContent = `${route} · ${completionProof} · ${(engine.latencyMs / 1000).toFixed(1)}s · ${modelProof} · ${effortProof} · source provenance checked by code · relation is an AI judgment`;
  } else {
    elements.challengeEngineNote.textContent = `Deterministic offline fixture · ${engine.fallbackReason.replaceAll("_", " ")} · not a live AI judgment · the same response contract is used when GPT‑5.6 is live`;
  }

  state.revision = state.claim;
  elements.revisionInput.value = state.revision;
  elements.responseInput.value = "";
  state.response = "";
  renderRevisionState();
  setStage(3);
  scheduleThreads();
  elements.challengeSection.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#challenge-title").focus({ preventScroll: true });
}

async function runCrossExamination() {
  if (state.loading) return;
  state.loading = true;
  const progressTimers = [];
  elements.challengeButton.disabled = true;
  elements.challengeButton.querySelector("span:first-child").textContent = "Opposing counsel is reading…";
  setStatus(
    elements.claimStatus,
    "Step 1 of 3 · Reading the closed record. GPT-5.6 max reasoning usually takes about 20–35 seconds."
  );
  progressTimers.push(
    setTimeout(() => {
      if (state.loading) {
        setStatus(elements.claimStatus, "Step 2 of 3 · Testing the claim for one material weakness.");
      }
    }, 8000),
    setTimeout(() => {
      if (state.loading) {
        setStatus(
          elements.claimStatus,
          "Step 3 of 3 · Waiting for the response; server code will verify every returned source ID."
        );
      }
    }, 22000)
  );

  try {
    const response = await fetch("/api/cross-examine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: state.claim,
        citedSourceIds: [...state.selected],
        safetyIdentifier: state.safetyIdentifier
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Cross-examination failed");
    state.challenge = payload.challenge;
    state.challengeEngine = payload.engine;
    state.engine = payload.engine;
    renderEngine();
    state.beforeMetrics = calculateMetrics(state.claim, "", state.challenge);
    renderChallenge();
    if (payload.engine.mode !== "live") {
      showToast("The live bench was unavailable, so the verified offline challenge was used.");
    }
  } catch (error) {
    setStatus(elements.claimStatus, error.message || "The bench could not read this claim.", "error");
  } finally {
    progressTimers.forEach(clearTimeout);
    state.loading = false;
    elements.challengeButton.querySelector("span:first-child").textContent = "Cross-examine my claim";
    renderClaimState();
  }
}

function renderRevisionState() {
  if (!state.challenge) return;
  const metrics = renderMetrics(calculateMetrics(state.revision, state.response, state.challenge));
  const invalidIds = [...new Set([...metrics.invalidCitationIds, ...metrics.invalidResponseCitationIds])];
  const challengedIds = new Set(state.challenge.sourceIds);
  const responseCitations = extractCitationIds(state.response);
  const citesOpposition = responseCitations.some((id) => challengedIds.has(id));

  if (invalidIds.length) {
    setStatus(elements.revisionStatus, `Unknown record marker: ${invalidIds.join(", ")}. Use only S01–S10.`, "error");
  } else if (metrics.responseWordCount < 8) {
    setStatus(elements.revisionStatus, "Answer the challenge in at least one developed sentence.");
  } else if (!citesOpposition) {
    setStatus(elements.revisionStatus, `Cite the opposing record: ${state.challenge.sourceIds.join(" or ")}.`, "error");
  } else if (metrics.uncitedAssertionRate > 0) {
    setStatus(elements.revisionStatus, "Your reply cites the opposing record. Add a valid marker to every revised assertion.");
  } else {
    setStatus(elements.revisionStatus, "The reply cites an opposing source, and every developed assertion has a valid record marker.", "ready");
  }
  return metrics;
}

function sealBrief() {
  const metrics = calculateMetrics(state.revision, state.response, state.challenge);
  const invalidIds = [...new Set([...metrics.invalidCitationIds, ...metrics.invalidResponseCitationIds])];
  const challengedIds = new Set(state.challenge.sourceIds);
  const citesOpposition = extractCitationIds(state.response).some((id) => challengedIds.has(id));
  if (invalidIds.length) {
    setStatus(elements.revisionStatus, `Remove unknown record marker${invalidIds.length > 1 ? "s" : ""}: ${invalidIds.join(", ")}.`, "error");
    if (metrics.invalidResponseCitationIds.length) elements.responseInput.focus();
    else elements.revisionInput.focus();
    return;
  }
  if (metrics.responseWordCount < 8 || !citesOpposition) {
    setStatus(
      elements.revisionStatus,
      `Before sealing, write a developed reply and cite ${state.challenge.sourceIds.join(" or ")}.`,
      "error"
    );
    elements.responseInput.focus();
    return;
  }
  if (metrics.uncitedAssertionRate > 0) {
    setStatus(elements.revisionStatus, "Every assertion in the revised claim needs a valid source marker.", "error");
    elements.revisionInput.focus();
    return;
  }

  state.finalMetrics = metrics;
  elements.briefBefore.textContent = state.claim;
  elements.briefAfter.textContent = state.revision;
  const deltas = [
    {
      label: "Uncited assertions",
      before: state.beforeMetrics.uncitedAssertionRate,
      after: metrics.uncitedAssertionRate,
      inverse: true
    },
    {
      label: "Evidence coverage",
      before: state.beforeMetrics.evidenceCoverage,
      after: metrics.evidenceCoverage
    },
    {
      label: "Opposing record cited",
      before: state.beforeMetrics.counterevidenceAddressed,
      after: metrics.counterevidenceAddressed
    },
    { label: "Record-use score", before: state.beforeMetrics.readiness, after: metrics.readiness }
  ];
  elements.briefDeltas.innerHTML = deltas
    .map((item) => {
      const change = item.after - item.before;
      const favorable = item.inverse ? -change : change;
      const symbol = favorable > 0 ? "↑" : favorable < 0 ? "↓" : "→";
      return `<div class="delta-item"><span>${escapeHtml(item.label)}</span><strong>${item.before}% ${symbol} ${item.after}%</strong></div>`;
    })
    .join("");
  elements.sealedBrief.hidden = false;
  setStage(4);
  elements.sealedBrief.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#brief-title").focus({ preventScroll: true });
}

function sourceLines(ids) {
  return ids
    .map((id) => state.caseFile.sources.find((source) => source.id === id))
    .filter(Boolean)
    .map((source) => `- ${source.id}: ${source.title} — ${source.url}`)
    .join("\n");
}

function opposingRecordLines(sources) {
  return sources
    .map(
      (source) =>
        `- ${source.id}: ${source.title}\n  - Exact local excerpt: “${source.excerpt}”\n  - Original: ${source.url}`
    )
    .join("\n");
}

function engineLine(engine) {
  if (engine.mode !== "live") {
    return `Fixture (${engine.fallbackReason.replaceAll("_", " ")}); not a live model response`;
  }
  const route = engine.route === "chat_completions_compat" ? "Chat Completions compatibility" : "Responses API";
  const providerModel =
    engine.providerVerification?.model === "matched"
      ? `provider model ${engine.providerModel} matched`
      : "provider model not reported";
  const providerEffort =
    engine.providerVerification?.reasoningEffort === "matched"
      ? "provider reported max effort"
      : "max effort requested; provider did not report it";
  const providerStatus = engine.providerStatus
    ? `provider status ${engine.providerStatus}`
    : "provider status not reported";
  const requestId = engine.requestId ? `request ID ${engine.requestId}` : "request ID not reported";
  return `requested ${engine.model}; reasoning ${engine.reasoningEffort}; ${route}; ${engine.latencyMs} ms; ${providerModel}; ${providerEffort}; ${providerStatus}; ${requestId}`;
}

function downloadBrief() {
  const cited = extractCitationIds(`${state.revision} ${state.response}`);
  const generatedAt = new Date().toISOString();
  const content = `# SourceCourt evidence brief\n\n` +
    `**Case:** ${state.caseFile.title} (${state.caseFile.id})\n\n` +
    `**Generated:** ${generatedAt}\n\n` +
    `**Cross-examination engine:** ${engineLine(state.challengeEngine)}\n\n` +
    `## Opening claim\n\n${state.claim}\n\n` +
    `## Cross-examination\n\n` +
    `**AI relation judgment:** ${state.challenge.relation.replaceAll("_", " ")}\n\n` +
    `> ${state.challenge.challenge}\n\n` +
    `${state.challenge.counterpoint}\n\n` +
    `**Question:** ${state.challenge.nextQuestion}\n\n` +
    `## Opposing record resolved by code\n\n${opposingRecordLines(state.challenge.verifiedSources)}\n\n` +
    `## Learner response\n\n${state.response}\n\n` +
    `## Revised claim\n\n${state.revision}\n\n` +
    `## Deterministic audit\n\n` +
    `- Uncited assertion rate: ${state.finalMetrics.uncitedAssertionRate}%\n` +
    `- Evidence coverage: ${state.finalMetrics.evidenceCoverage}%\n` +
    `- Opposing record response signal: ${state.finalMetrics.counterevidenceAddressed}%\n` +
    `- Record-use score: ${state.finalMetrics.readiness}/100\n\n` +
    `## Record cited\n\n${sourceLines(cited)}\n\n` +
    `---\nGenerated by SourceCourt. These surface metrics can be gamed and do not assess semantic support, writing quality, or historical truth. ` +
    `The cross-examination is an AI judgment and may be wrong; source IDs and attached excerpts are checked by code.\n`;

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sourcecourt-evidence-brief.md";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Evidence brief downloaded.");
}

function resetCase() {
  state.selected.clear();
  state.claim = state.caseFile.starterClaim;
  state.response = "";
  state.revision = "";
  state.challenge = null;
  state.challengeEngine = null;
  state.beforeMetrics = null;
  state.finalMetrics = null;
  state.loading = false;
  elements.claimInput.value = state.claim;
  elements.responseInput.value = "";
  elements.revisionInput.value = "";
  elements.challengeSection.hidden = true;
  elements.sealedBrief.hidden = true;
  renderSources();
  renderClaimState();
  setStage(1);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scheduleThreads() {
  cancelAnimationFrame(threadFrame);
  threadFrame = requestAnimationFrame(drawThreads);
}

function bezierPath(fromX, fromY, toX, toY) {
  const bend = Math.max(50, Math.abs(toX - fromX) * 0.46);
  return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`;
}

function drawThreads() {
  if (!state.caseFile || window.matchMedia("(max-width: 820px)").matches) {
    elements.threadPaths.replaceChildren();
    return;
  }
  const workspaceRect = $("#case-workspace").getBoundingClientRect();
  const claimRect = $("#claim-sheet").getBoundingClientRect();
  elements.threadLayer.setAttribute("viewBox", `0 0 ${workspaceRect.width} ${workspaceRect.height}`);
  elements.threadLayer.setAttribute("width", workspaceRect.width);
  elements.threadLayer.setAttribute("height", workspaceRect.height);

  const namespace = "http://www.w3.org/2000/svg";
  const fragment = document.createDocumentFragment();
  [...state.selected].forEach((id, index) => {
    const card = $(`.source-card[data-source-id="${id}"]`);
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    const source = state.caseFile.sources.find((item) => item.id === id);
    const path = document.createElementNS(namespace, "path");
    const fromX = cardRect.right - workspaceRect.left;
    const fromY = cardRect.top - workspaceRect.top + cardRect.height / 2;
    const toX = claimRect.left - workspaceRect.left;
    const toY = claimRect.top - workspaceRect.top + 118 + index * 9;
    path.setAttribute("d", bezierPath(fromX, fromY, toX, toY));
    path.setAttribute(
      "class",
      `evidence-thread${source?.stance === "complicates" ? " is-complicating" : ""}`
    );
    fragment.append(path);
  });

  if (state.challenge && !elements.challengeSection.hidden) {
    const challengeRect = $(".challenge-card").getBoundingClientRect();
    const path = document.createElementNS(namespace, "path");
    const fromX = claimRect.right - workspaceRect.left;
    const fromY = claimRect.bottom - workspaceRect.top - 38;
    const toX = challengeRect.right - workspaceRect.left;
    const toY = challengeRect.top - workspaceRect.top + 70;
    path.setAttribute(
      "d",
      `M ${fromX} ${fromY} C ${fromX + 80} ${fromY + 40}, ${toX + 70} ${toY - 60}, ${toX} ${toY}`
    );
    path.setAttribute("class", "challenge-thread");
    fragment.append(path);
  }
  elements.threadPaths.replaceChildren(fragment);
}

function bindEvents() {
  elements.sourceList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.sourceId;
    if (button.dataset.action === "cite") insertCitation(id);
    if (button.dataset.action === "inspect") openSource(id);
  });

  elements.claimInput.addEventListener("input", () => {
    state.claim = elements.claimInput.value;
    const previous = new Set(state.selected);
    const valid = new Set(state.caseFile.sources.map((source) => source.id));
    state.selected = new Set(extractCitationIds(state.claim).filter((id) => valid.has(id)));
    const selectionChanged =
      previous.size !== state.selected.size || [...previous].some((id) => !state.selected.has(id));
    if (selectionChanged) renderSources();
    renderClaimState();
  });

  elements.challengeButton.addEventListener("click", runCrossExamination);
  elements.resetButton.addEventListener("click", resetCase);
  elements.responseInput.addEventListener("input", () => {
    state.response = elements.responseInput.value;
    renderRevisionState();
  });
  elements.revisionInput.addEventListener("input", () => {
    state.revision = elements.revisionInput.value;
    renderRevisionState();
  });
  elements.sealButton.addEventListener("click", sealBrief);
  elements.returnButton.addEventListener("click", () => {
    $("#revision-sheet").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  elements.downloadButton.addEventListener("click", downloadBrief);
  elements.dialogCite.addEventListener("click", () => {
    if (state.activeDialogSource) insertCitation(state.activeDialogSource);
  });
  window.addEventListener("resize", scheduleThreads);
  window.addEventListener("scroll", scheduleThreads, { passive: true });
  document.fonts?.ready.then(scheduleThreads);
}

async function initialize() {
  try {
    const [caseResponse, healthResponse] = await Promise.all([fetch("/api/case"), fetch("/api/health")]);
    if (!caseResponse.ok || !healthResponse.ok) throw new Error("The case record could not be opened.");
    state.caseFile = await caseResponse.json();
    const health = await healthResponse.json();
    state.engine = health.engine;
    state.claim = state.caseFile.starterClaim;
    elements.claimInput.value = state.claim;
    populateCaseHeader();
    renderEngine();
    renderSources();
    renderClaimState();
    bindEvents();
    setStage(1);
  } catch (error) {
    elements.engineLabel.textContent = "Case unavailable";
    setStatus(elements.claimStatus, error.message || "The case could not be opened.", "error");
  }
}

initialize();
