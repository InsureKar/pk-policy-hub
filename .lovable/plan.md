# Custom instalment plans: paid tagging and adding instalments later

Two changes, both limited to custom ("set your own plan") instalments. Nothing else in the CRM changes.

## 1. Tag only paid instalments, in the month they were marked paid

Custom plans behave exactly like quarterly/bi-annual:

- An instalment counts only once its status is set to **Paid**. While it is **Due**, its amount stays outstanding and is not counted as collected.
- The moment an instalment is switched to Paid and saved, it is tagged to the **current month and year** (the month the user marked it paid), regardless of the receive date entered.
- Once tagged, the month stays fixed — re-saving the deal later does not re-tag it to a newer month. If the status is switched back to Due, the tag is cleared and the instalment becomes outstanding again.
- Outstanding premium for the deal is the sum of the amounts of instalments still marked Due, so the overview Outstanding Premium box and the Won figures keep working the same way as for quarterly plans.

## 2. Add and edit the next instalment from an existing deal

On a deal that uses a custom plan, opening the deal shows its saved instalment schedule with:

- Editable due date, amount, and the Paid/Due status with its collection details (method, receive date, transaction/cheque reference, remarks) and payment receipt, exactly as on the new-deal screen.
- The same per-instalment breakdown boxes (Gross, Net, Loading, B2B commission and taker, Marketing, Commission) with the calculations shown below the schedule, using the existing calculation engine.
- An **Add Instalment** button to append the next instalment, and removal of an unsaved/extra row.
- Marking a newly added instalment Paid tags it to the month it was marked paid, per rule 1.

Adding instalments stays custom-plans-only. Quarterly, bi-annual, monthly and annual deals keep their fixed periods and current behaviour.

## Technical notes

- `src/routes/_app.deals.new.tsx`: apply the quarterly `dueOf` / settle logic to `isCustom`; set `tagged_month` / `tagged_year` from `new Date()` when `payment_status === "paid"` (instead of from `paid_date`), and `null` when due.
- `src/components/DealInstalments.tsx` (used by `src/routes/_app.deals.$id.tsx`): currently returns `null` for custom schedules because `instalmentCount()` yields 0. Add a custom branch that loads existing `deal_installments` rows, allows editing/appending rows, and upserts on `(deal_id, installment_number)` with the same column set the new-deal screen writes (`payment_status`, `payment_mode`, `payment_receive_date`, `transaction_reference`, `payment_remarks`, per-period financials, `tagged_month`/`tagged_year`).
- Tagging is preserved on update: only stamp month/year when the stored row has none and the status is paid.
- No schema change is needed — all required columns already exist on `deal_installments`.
- Verify with `bunx tsgo --noEmit -p tsconfig.json` and load a custom-plan deal.
