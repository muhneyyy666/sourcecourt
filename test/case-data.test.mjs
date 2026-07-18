import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CASE_FILE } from "../lib/case-data.mjs";

test("the closed record has ten complete, unique, short source cards", () => {
  assert.equal(CASE_FILE.sources.length, 10);
  assert.deepEqual(
    CASE_FILE.sources.map((source) => source.id),
    ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"]
  );
  for (const source of CASE_FILE.sources) {
    for (const field of ["title", "kind", "author", "date", "summary", "excerpt", "limitation", "url"]) {
      assert.equal(typeof source[field], "string", `${source.id}.${field} must be text`);
      assert.ok(source[field].trim(), `${source.id}.${field} must not be empty`);
    }
    assert.ok(source.excerpt.trim().split(/\s+/).length <= 25, `${source.id} excerpt is too long`);
    assert.equal(new URL(source.url).protocol, "https:");
  }
});

test("the judge-reviewed source excerpts and URLs have a stable fingerprint", () => {
  const material = CASE_FILE.sources.map(({ id, excerpt, url }) => ({ id, excerpt, url }));
  const fingerprint = createHash("sha256").update(JSON.stringify(material)).digest("hex");
  assert.equal(fingerprint, "d08d41088b534d6d5e750940cecc96353d0770c92523bd9235859e8e46659a07");
});
