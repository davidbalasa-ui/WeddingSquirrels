import assert from "node:assert/strict";
import { test } from "node:test";
import {
  giftDescriptions,
  giftPrintRows,
  guestAddressLines,
  guestNameLines,
} from "./guest-gifts";

test("guest names stack person 2 on its own line", () => {
  assert.deepEqual(guestNameLines({ nameLine1: "Jane Smith", nameLine2: "John Smith" }), [
    "Jane Smith",
    "John Smith",
  ]);
  assert.deepEqual(guestNameLines({ nameLine1: "Aunt May", nameLine2: "  " }), ["Aunt May"]);
});

test("guest address uses mailing lines", () => {
  assert.deepEqual(
    guestAddressLines({
      street: "123 Oak St",
      city: "Detroit",
      state: "MI",
      zip: "48201",
    }),
    ["123 Oak St", "Detroit, MI 48201"],
  );
  assert.deepEqual(
    guestAddressLines({ street: null, city: null, state: null, zip: null }),
    [],
  );
});

test("gift descriptions drop blank items", () => {
  assert.deepEqual(
    giftDescriptions([{ description: "Mixer" }, { description: "  " }, { description: "Towels" }]),
    ["Mixer", "Towels"],
  );
});

test("print rows keep names, address, and gifts in two columns", () => {
  const rows = giftPrintRows([
    {
      id: "1",
      nameLine1: "Jane Smith",
      nameLine2: "John Smith",
      street: "123 Oak St",
      city: "Detroit",
      state: "MI",
      zip: "48201",
      gifts: [{ description: "Mixer" }, { description: "Card" }],
    },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]?.nameLines, ["Jane Smith", "John Smith"]);
  assert.deepEqual(rows[0]?.addressLines, ["123 Oak St", "Detroit, MI 48201"]);
  assert.deepEqual(rows[0]?.gifts, ["Mixer", "Card"]);
});
