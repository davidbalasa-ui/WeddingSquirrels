import assert from "node:assert/strict";
import { test } from "node:test";
import {
  seatForPersonName,
  tableSeatingLabel,
  tableSpotForSeat,
} from "./guest-seating-chart";

test("seatForPersonName matches chart names and aliases", () => {
  assert.equal(seatForPersonName("Elisha Balasa")?.tableNumber, 1);
  assert.equal(seatForPersonName("Baby G")?.tableNumber, 6);
  assert.equal(seatForPersonName("Marie Wiewiora +1")?.tableNumber, 4);
  assert.equal(seatForPersonName("Mykah McKay")?.tableNumber, 9);
  assert.equal(seatForPersonName("Claire Crossbow")?.tableNumber, 7);
  assert.equal(seatForPersonName("Mary Ramos"), null);
});

test("tableSeatingLabel uses floor-plan names", () => {
  assert.equal(tableSeatingLabel(0), "Head");
  assert.equal(tableSeatingLabel(1), "South 1");
  assert.equal(tableSeatingLabel(6), "North 1");
  assert.equal(tableSeatingLabel(14), "Table 14");
  assert.equal(tableSpotForSeat({ tableNumber: 1, note: "child" }), "South 1 · child");
});
