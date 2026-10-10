import assert from "node:assert/strict";
import { test } from "node:test";
import { multilineFieldValue } from "./form-text";

test("multilineFieldValue stores textarea line breaks as LF, as the textarea shows them", () => {
  assert.equal(multilineFieldValue("line1\r\n\r\nline3"), "line1\n\nline3");
  assert.equal(multilineFieldValue("a\rb"), "a\nb");
  assert.equal(multilineFieldValue("already\n\nfine"), "already\n\nfine");
});

test("multilineFieldValue trims, and treats a missing or whitespace-only value as empty", () => {
  assert.equal(multilineFieldValue("  \r\n  "), "");
  assert.equal(multilineFieldValue(null), "");
  assert.equal(multilineFieldValue(undefined), "");
  assert.equal(multilineFieldValue(" Test note \r\n"), "Test note");
});
