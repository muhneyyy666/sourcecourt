const CITATION_PATTERN = /\[(S\d{2})\]/gi;
const ABSOLUTE_LANGUAGE = /\b(sole|only|proves?|certainly|all|always|entirely|undeniabl\w*)\b/gi;

export function extractCitationIds(text = "") {
  const ids = [];
  for (const match of String(text).matchAll(CITATION_PATTERN)) {
    const id = match[1].toUpperCase();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function splitAssertions(text = "") {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\s*;\s*/)
    .map((part) => part.trim())
    .filter((part) => {
      const words = part.replace(CITATION_PATTERN, "").match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) || [];
      return words.length >= 3;
    });
}

export function scoreArgument({ claim = "", response = "", challenge = null, caseFile } = {}) {
  if (!caseFile?.sources || !caseFile?.facets) throw new Error("A case record is required for scoring");

  const validIds = new Set(caseFile.sources.map((source) => source.id));
  const assertions = splitAssertions(claim);
  const citedIds = extractCitationIds(claim).filter((id) => validIds.has(id));
  const citedSet = new Set(citedIds);
  const uncitedAssertions = assertions.filter((assertion) => {
    const ids = extractCitationIds(assertion).filter((id) => validIds.has(id));
    return ids.length === 0;
  });

  const uncitedRate = assertions.length
    ? Math.round((uncitedAssertions.length / assertions.length) * 100)
    : 100;

  const coveredFacets = new Set();
  for (const source of caseFile.sources) {
    if (!citedSet.has(source.id)) continue;
    for (const facet of source.facets) coveredFacets.add(facet);
  }
  const evidenceCoverage = caseFile.facets.length
    ? Math.round((coveredFacets.size / caseFile.facets.length) * 100)
    : 0;

  const responseCitations = extractCitationIds(response).filter((id) => validIds.has(id));
  const challengedIds = new Set(challenge?.sourceIds || []);
  const respondsToRecord = responseCitations.some((id) => challengedIds.has(id));
  const responseWordCount = String(response)
    .replace(CITATION_PATTERN, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const counterevidenceAddressed = !challenge || !respondsToRecord
    ? 0
    : responseWordCount >= 18
      ? 100
      : responseWordCount >= 8
        ? 50
        : 0;

  const absoluteTerms = [...String(claim).matchAll(ABSOLUTE_LANGUAGE)].map((match) => match[0]);
  const sourceDiversity = new Set(
    caseFile.sources.filter((source) => citedSet.has(source.id)).map((source) => source.kind)
  ).size;
  const readiness = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (100 - uncitedRate) * 0.35 +
          evidenceCoverage * 0.4 +
          counterevidenceAddressed * 0.25
      )
    )
  );

  return {
    uncitedAssertionRate: uncitedRate,
    evidenceCoverage,
    counterevidenceAddressed,
    readiness,
    assertionCount: assertions.length,
    citedSourceCount: citedSet.size,
    sourceDiversity,
    absoluteTerms,
    coveredFacets: [...coveredFacets],
    invalidCitationIds: extractCitationIds(claim).filter((id) => !validIds.has(id)),
    invalidResponseCitationIds: extractCitationIds(response).filter((id) => !validIds.has(id)),
    responseWordCount,
    respondsToRecord,
    semanticSupportAssessed: false
  };
}
