# Custom plan: independent commission, tagged-premium Won, and true payment dates

All changes are limited to Custom ("Set Your Own Plan") instalments and the Business Overview
figures they feed. Quarterly, Bi-Annual, Annual and every other part of the CRM stay as they are.

## 1. Each instalment keeps its own commission

Every custom instalment already has its own hand-written Gross, Net, Commission %, Marketing %,
Loading and B2B commission, and its money figures are worked out on their own. What changes is
what gets written back to the deal: today the deal is updated with one blended commission
percentage across all instalments, which makes Instalment 1 at 10% and Instalment 2 at 5% look
like one averaged rate.

After the change, each saved instalment keeps and shows its own commission percentage and its own
commission amount. The deal-level figure is only a total of the instalment amounts — it never
rewrites, averages or redistributes any instalment's own percentage.

## 2. Won Business shows Tagged Premium

For custom-plan deals, the Won column in Business Overview shows the Tagged Premium of the paid
instalments only:

- Each paid instalment's Tagged Premium is worked out with the existing Tagged Premium formula
  from that instalment's own figures.
- Only paid instalments are added up. Unpaid ones contribute nothing to Won.
- Unpaid instalments keep appearing in the Outstanding Premium box (unchanged).
- Deals that are not on a custom plan keep their current Won behaviour.

## 3. Paid business lands on its real payment date

Business Overview currently places a custom-plan deal by the date the deal was created. It will
instead place each paid instalment by its own paid date.

- A payment recorded for March 2027 appears in March 2027, even if it was entered today.
- Works for Month Wise, Quarter Wise and Year Wise the same way.
- A deal whose paid instalment falls inside the selected period is included in the Won figure for
  that period even if the deal itself was created earlier.
- Unpaid instalments continue to be shown against the deal as Outstanding.

## 4. Each instalment stays its own record

Instalment date, scheduled amount, paid amount, paid date, commission %, commission amount,
Tagged Premium and payment status are each held per instalment and never merged. The instalment
panel shows its own commission amount next to its Tagged Premium so the numbers are traceable.

## Technical notes

- `src/components/DealCustomInstalments.tsx`: `rollupDeal` stops deriving a blended
  `commission_percentage` / `marketing_budget_percentage`; it writes the summed
  gross/net/loading/b2b and the commission/marketing totals in a way that preserves each
  instalment's own amounts, leaving per-row `commission_percentage` and `commission` untouched in
  `deal_installments`. Add a read-only Commission Amount box beside Tagged Premium in the row panel.
- `src/components/PipelineFunnel.tsx`: the instalment query also selects
  `net_premium, commission_percentage, marketing_budget, loading, b2b_commission, paid_date,
  due_date, deal_id`; deals query adds `payment_schedule` and `base_percentage`. Build a per-deal
  map of paid instalments with their Tagged Premium via `calculateDealFinancials`. For custom-plan
  deals the Won-stage value becomes the sum of Tagged Premium of paid instalments whose
  `paid_date` (fallback `payment_receive_date`, then `due_date`) is inside the applied range, and
  such deals are pulled into the filtered set even when `created_at` is outside it. Non-custom
  deals keep `wonValue`/`created_at` behaviour exactly.
- No schema change: every column needed already exists on `deal_installments`.
- Verify with `bunx tsgo --noEmit -p tsconfig.json` and by loading the dashboard.
