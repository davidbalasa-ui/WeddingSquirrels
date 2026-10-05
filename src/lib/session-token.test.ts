import assert from "node:assert/strict";
import { test } from "node:test";
import { jwtVerify } from "jose";
import {
  SESSION_MAX_AGE,
  SESSION_RENEW_AFTER,
  sessionSecret,
  shouldRenewSession,
  signSessionToken,
} from "./session-token";

test("shouldRenewSession only renews tokens older than a day", () => {
  const now = 1_000_000;
  assert.equal(shouldRenewSession(now - 60, now), false);
  assert.equal(shouldRenewSession(now - SESSION_RENEW_AFTER, now), false);
  assert.equal(shouldRenewSession(now - SESSION_RENEW_AFTER - 1, now), true);
  assert.equal(shouldRenewSession(undefined, now), true);
});

test("signSessionToken issues a 30 day token for the account", async () => {
  const token = await signSessionToken("acct_1");
  const { payload } = await jwtVerify(token, sessionSecret());
  assert.equal(payload.accountId, "acct_1");
  assert.equal((payload.exp ?? 0) - (payload.iat ?? 0), SESSION_MAX_AGE);
  assert.equal(SESSION_MAX_AGE, 60 * 60 * 24 * 30);
});
