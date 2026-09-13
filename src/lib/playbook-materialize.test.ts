import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CANONICAL_PLAYBOOK,
  mergeCanonicalPlaybookWithPersisted,
  playbookByKind,
  playbookCreateInputFromSourceKey,
  playbookRecordByKey,
} from "./playbook";

test("playbookCreateInputFromSourceKey preserves canonical identity fields", () => {
  const sample = playbookByKind(CANONICAL_PLAYBOOK, "hair_makeup")[0]!;
  const input = playbookCreateInputFromSourceKey(sample.sourceKey);
  assert.ok(input);
  assert.equal(input.sourceKey, sample.sourceKey);
  assert.equal(input.kind, sample.kind);
  assert.equal(input.title, sample.title);
  assert.equal(input.sortOrder, sample.sortOrder);
});

test("mergeCanonicalPlaybookWithPersisted overlays id without dropping sibling fallbacks", () => {
  const canonical = playbookByKind(CANONICAL_PLAYBOOK, "hair_makeup").slice(0, 3);
  const target = canonical[1]!;
  const merged = mergeCanonicalPlaybookWithPersisted(canonical, [
    {
      ...target,
      id: "db-1",
      title: "Edited title",
    },
  ]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0]?.id, undefined);
  assert.equal(merged[1]?.id, "db-1");
  assert.equal(merged[1]?.title, "Edited title");
  assert.equal(merged[2]?.id, undefined);
});

test("materialize-on-edit duplicate prevention by sourceKey (in-memory upsert)", () => {
  const sourceKey = playbookByKind(CANONICAL_PLAYBOOK, "shot")[0]!.sourceKey;
  const store = new Map<string, { id: string; sourceKey: string; title: string }>();
  let seq = 0;

  function materialize(key: string, title?: string) {
    const existing = store.get(key);
    if (existing) {
      if (title) existing.title = title;
      return existing;
    }
    const canonical = playbookRecordByKey(key);
    assert.ok(canonical);
    const row = { id: `row-${++seq}`, sourceKey: key, title: title ?? canonical.title };
    store.set(key, row);
    return row;
  }

  const first = materialize(sourceKey);
  const second = materialize(sourceKey, "Updated shot");
  assert.equal(first.id, second.id);
  assert.equal(store.size, 1);
  assert.equal(second.title, "Updated shot");
});
