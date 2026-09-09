import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CANONICAL_PLAYBOOK,
  OPERATIONAL_PAGE_HREFS,
  OPERATIONAL_PAGE_NEED,
  groupPlaybookSections,
  playbookByKind,
  playbookSourceKeys,
  profileOperationalLinks,
  profilePlaybookMatches,
} from "./playbook";

test("canonical playbook sourceKeys are unique and shots start uncompleted", () => {
  const keys = playbookSourceKeys();
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(CANONICAL_PLAYBOOK.every((row) => row.completed === false), true);
  assert.equal(
    playbookByKind(CANONICAL_PLAYBOOK, "shot").every((row) => row.completed === false),
    true,
  );
});

test("hair/makeup, shots, decor, lineup, and coordinator are distinct kinds", () => {
  assert.ok(playbookByKind(CANONICAL_PLAYBOOK, "hair_makeup").length > 8);
  assert.ok(playbookByKind(CANONICAL_PLAYBOOK, "shot").length > 10);
  assert.ok(playbookByKind(CANONICAL_PLAYBOOK, "decor").some((row) => /sword/i.test(row.title)));
  assert.ok(playbookByKind(CANONICAL_PLAYBOOK, "lineup").some((row) => /Haley with Dad/i.test(row.title)));
  assert.ok(
    playbookByKind(CANONICAL_PLAYBOOK, "coordinator").some((row) =>
      /point person/i.test(`${row.title} ${row.notes ?? ""}`),
    ),
  );
  assert.equal(
    playbookByKind(CANONICAL_PLAYBOOK, "hair_makeup").some((row) => /Katie/i.test(`${row.title} ${row.notes ?? ""}`)),
    true,
  );
});

test("groupPlaybookSections keeps chronological hair stations together", () => {
  const groups = groupPlaybookSections(playbookByKind(CANONICAL_PLAYBOOK, "hair_makeup"));
  assert.ok(groups.some((group) => group.section === "9:00 AM"));
  assert.ok(groups.some((group) => group.section === "Rooms"));
});

test("profile operational links are projections, not extra identities", () => {
  assert.deepEqual(profilePlaybookMatches("Kurt Huizenga"), ["lineup"]);
  assert.equal(
    profileOperationalLinks("Kurt Huizenga").some((link) => link.href === "/day/mc"),
    true,
  );
  assert.equal(
    profileOperationalLinks("Avalon Green").some((link) => link.href === "/day/decor"),
    true,
  );
  assert.equal(
    profileOperationalLinks("Barry Tilson").some((link) => link.href === "/day/shots"),
    true,
  );
  assert.equal(
    profileOperationalLinks("Katie").some((link) => link.href === "/day/hair-makeup"),
    true,
  );
});

test("new operational pages stay under Day-of and require timeline permission", () => {
  assert.equal(OPERATIONAL_PAGE_NEED, "canSeeTimeline");
  assert.deepEqual([...OPERATIONAL_PAGE_HREFS], [
    "/day/mc",
    "/day/hair-makeup",
    "/day/shots",
    "/day/decor",
  ]);
  assert.equal(
    OPERATIONAL_PAGE_HREFS.every((href) => href.startsWith("/day/")),
    true,
  );
});
