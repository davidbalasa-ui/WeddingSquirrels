# Field sweep · Area: Budget and money (`/money`, `/money/[itemId]`, `/money/due`, `/money/history`, `/money/print`)

Worktree `wt/money`, port 3304, DB `wedding_money`. The seeded DB had no budget items; every test
contract, payment and "other spending" task is created by the spec itself (prefix `Sweep money`)
and removed again afterwards. Spec: `e2e/overnight/fields-money.spec.ts` (12 tests × desktop and
phone, all passing on the rebuilt server). Unit tests for the new pure helper are in
`src/lib/money.test.ts`.

Design decisions for "empty":
- `BudgetItem.price` (Float, not null) and `BudgetItem.amountPaid` (Float, default 0) cannot hold
  null, and the page shows them as "$X contract" / "Paid $X". Price is something the app really
  needs, so clearing it now says "Enter an amount" and keeps the form open; it no longer writes $0.
  Paid so far: empty means nothing paid, which is 0 by the schema and shows as "Paid $0"; the edit
  box now comes back empty (not "0") the way Other spending's Spent box already did.
- `Task.amountNeeded` is nullable and the page already handles null (needed falls back to spent),
  so empty stays null. `Task.amountSpent` is not null, default 0: empty stays 0 and shows empty.
- `BudgetPayment.amount` must be > 0 for the server to accept it, so the form now says so.
- Validation uses the browser's own validity message (`setCustomValidity`), the same mechanism the
  payment Amount box already used through `required`, with a pure helper `moneyInputProblem` in
  `src/lib/money.ts` shared by all seven money boxes.

---

### 1. /money/[itemId] · Price (Edit contract)
- What I did: Edit contract, backspaced the price to empty, Save. Also typed `abc`.
- What happened: the form closed as if saved and the contract became "$0 contract", Paid/Remaining
  $0; re-opening the editor showed "0" in the box. `abc` did the same (parseFloat → NaN → 0).
- What should happen: the app needs a price; it should say so and keep the form open, never write
  $0 from a cleared or garbage box.
- Status: fixed. `MoneyContractEditor` price is `required`, shows empty for a $0 contract
  (`contract.price || ""`), and sets a validity message from `moneyInputProblem` ("Enter an
  amount" / "Enter a number like 1,250.50" / "An amount can’t be negative").
- Proof: fields-money.spec.ts::"clearing the price says Enter an amount and keeps the contract instead of saving $0" (also covers 0 → clear → 9 saves 9, one-char-at-a-time backspace).

### 2. /money/[itemId] · Paid so far (Edit contract)
- What I did: cleared Paid so far and saved; reopened the editor; typed `abc`; typed `12.50`.
- What happened: cleared → saved 0 (fine, nothing paid) but the box came back with a literal "0"
  in it; `abc` → silently saved as $0; `12.50` kept its cents.
- What should happen: empty box stays empty on re-edit; a typo is refused, not stored as $0.
- Status: fixed. `defaultValue={contract.amountPaid || ""}` + validity message. Empty → 0 kept
  (column is not null, the page shows "Paid $0").
- Proof: fields-money.spec.ts::"clearing Paid so far saves nothing paid and the box comes back empty, not 0"

### 3. /money/[itemId] · Contract name (Edit contract)
- What I did: blanked the name (and separately typed only spaces), Save.
- What happened: the server returned early (`if (!id || !name) return`), nothing saved, but the
  form closed and the page refreshed exactly as if the save had happened.
- What should happen: say the name is required and keep the form open.
- Status: fixed. `required` on the name input plus "Enter a name" validity for whitespace-only.
- Proof: fields-money.spec.ts::"blanking the contract name is refused instead of closing the form as if saved"

### 4. /money/[itemId] · Payment: Amount (Add a payment / Edit payment)
- What I did: typed `abc`, `0`, `-5` and nothing as the amount, pressed Add payment.
- What happened: blank was stopped by `required`, but `abc`, `0` and `-5` made the form close as
  if saved while the server dropped the payment (`amount <= MONEY_EPSILON` → return).
- What should happen: the form says what is wrong and stays open.
- Status: fixed. Amount sets a validity message with `{ required: true, positive: true }`
  ("Enter an amount greater than $0", "An amount can’t be negative", "Enter a number like 1,250.50").
- Proof: fields-money.spec.ts::"adding a payment with abc, 0 or -5 as the amount says so and keeps the form open" (also proves `$1,250.50` saves as 1250.5 with label, due date and a two-paragraph note)

### 5. /money/[itemId] · Payment: Paid checkbox when editing a partly paid payment
- What I did: a payment of $100 with $40 already paid (Paid box unticked); changed only its label
  and pressed Save payment.
- What happened: `saveBudgetPayment` read `paidAmount` from a form field that does not exist, got
  0, and wrote `paidAmount = 0`, `paidAt = null`: the $40 vanished from Paid and the row's
  remaining jumped from $60 to $100.
- What should happen: a label edit must not change what was paid. Ticking Paid pays the whole
  amount; unticking it on a fully paid row un-pays it; leaving it unticked on a partly paid row
  keeps the partial amount.
- Status: fixed in `actions.ts` `saveBudgetPayment`: the existing `amount`/`paidAmount` are read,
  and when the form has no `paidAmount` field the partial amount is kept (clamped to the new
  amount); a previously fully paid row that is unticked still goes to 0. Data contract unchanged
  for forms that do send `paidAmount`.
- Proof: fields-money.spec.ts::"editing the label of a partly paid payment keeps what was already paid instead of resetting it to $0" and ::"ticking Paid pays the whole amount, unticking it on a paid payment un-pays it, Mark paid and Remove work"

### 6. /money/[itemId] · Notes display
- What I did: saved a note with a blank line between two paragraphs.
- What happened: the textarea kept the lines, but the contract page rendered "line one line three"
  on one line (the `<p>` collapsed the newlines).
- What should happen: the note shows the way it was typed.
- Status: fixed with `whitespace-pre-line` on that paragraph (same pattern as OfflineApp notes).
- Proof: fields-money.spec.ts::"typing a vendor, cents, commas, a date and a two-paragraph note saves exactly and comes back after reload"

### 7. /money · Add a contract: Contract total / Paid so far
- What I did: typed `abc`, then `-5`, pressed Add contract.
- What happened: a $0 contract was created silently (`clampMoney(parseMoney ?? 0)`).
- What should happen: say what is wrong; only create the contract when the boxes hold a number.
- Status: fixed with the same validity message on both boxes. Leaving them blank on create is
  still allowed (a contract whose total is not known yet is a real case; the schema default is 0
  and the list shows "$0") — judgement call for David whether Contract total should be required on
  create too; making it so is one `required` attribute.
- Proof: fields-money.spec.ts::"typing abc or -5 for the contract total says what is wrong instead of adding a $0 contract" (also 0 → clear → 9 saves 9)

### 8. /money · Other spending: Needed / Spent
- What I did: typed `abc` in Needed; then `12.50` / `9`; then cleared both.
- What happened: `abc` in Needed saved as null and in Spent as 0 with no message; numbers saved
  with cents; clearing gave null / 0 and the boxes came back empty.
- What should happen: refuse `abc`; the rest is right.
- Status: fixed (validity message on both boxes). Empty → null (Needed) and empty → 0 (Spent) kept
  as designed; with nothing needed and nothing spent the row correctly leaves the Money list.
- Proof: fields-money.spec.ts::"Needed and Spent save cents, refuse abc, and clearing them comes back empty"

### 9. Display rounds cents (by design, flagged)
- What I did: contract total `1,000.50`, paid `12.5`.
- What happened: stored exactly (1000.5 / 12.5) but shown as "$1,001 contract", "Paid $13",
  "$988 remaining" because `formatMoney` defaults to whole dollars everywhere in Money.
- Status: not a bug by the app's own convention (whole-dollar display, cents kept in the data);
  judgement call for David if cents should show on the contract page.

### 10. Payment: Paid date typed while Paid is unticked (by design)
- Entering a paid date without ticking Paid (and with nothing paid) stores `paidAt = null`. A paid
  date only means something once something is paid; recorded as by design.

### 11. VendorEntryList (orphan)
- `VendorBudgetPanel` writes `Number("")` = 0 on blur, but no page renders `VendorEntryList`
  (no importer in `src/`). Not reachable by a user; left alone as out of scope for a bug-fix sweep.

### 12. Server actions with no UI caller
- `saveFundingSource` / `createFundingSource` (`amount ?? 0`), `setBudgetPayByDate`,
  `setBudgetPaidBy`, `setBudgetOwner`, `setBudgetItemShares`, `setTaskShares`: no field reaches
  them from the money pages; not exercised.

---

## Passed (full script, both projects)
- /money · Vendor or contract: text with quotes, backticks, angle brackets and emoji saves and
  displays verbatim (escaped, no markup); `required` stops an empty submit; Cancel discards.
- /money · Pay by date: `2027-03-04` saves as that calendar day (noon local; no day shift).
- /money · Notes: two paragraphs with a blank line; trailing spaces trimmed by the server.
- /money/[itemId] · Owner and Payer selects save "haley"/"david" and come back selected after reload.
- /money/[itemId] · Pay by date (legacy contract) saves and shows `2027-01-15` on re-edit.
- /money/[itemId] · Notes: 2,000-character note saves and comes back identical; Escape then Cancel
  discards an edit without saving.
- /money/[itemId] · Payment Label, Due date, Paid date, Note save; Mark paid, Remove (confirm),
  Edit/Cancel work from both the open list and History.
- /money/[itemId] · Remove contract: dismissing the confirm keeps it, accepting removes it and lands on /money.
- /money/due, /money/history, /money/print, /money: open with the test contract, no console or
  server errors, no sideways scroll at 1280×900 or Pixel 7.
- Keystrokes: all money boxes are uncontrolled inputs, so 0 → backspace → 9 shows and saves 9,
  one-character backspacing and fast typing lose nothing, and no server refresh steals focus
  while typing (saves only happen on Save/Add).

Fields exercised: 32 of 32 inventory rows (every input, select, checkbox, textarea and button in
the three tables; the read-only pages have no inputs).

## Note for the sweep runner
`restart-worker.sh` only `pkill`s the `next start -p <port>` wrapper; the original `next-server`
child kept port 3304 and the new server failed with EADDRINUSE, so the first spec run hit the old
code with a new `.next` folder and looped on detached elements. `fuser -k <port>/tcp` before the
restart fixes it.
