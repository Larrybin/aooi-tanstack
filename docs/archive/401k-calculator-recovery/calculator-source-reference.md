# Calculator source reference

The deployed calculator logic was recovered from the public resource:

`https://401k-calculator.net/js/app.js`

Observed calculation order:

1. The projection uses the whole-number difference between retirement age and
   current age as its annual iterations.
2. Salary grows at the start of each projected year.
3. Employee contribution equals grown salary times employee contribution rate.
4. Eligible employer match uses the lesser of employee rate and match-limit
   rate.
5. Existing balance receives the annual return before current-year
   contributions are added.
6. Investment growth is ending balance minus starting balance and both
   contribution totals.
7. Monthly retirement income is four percent of ending balance divided by
   twelve.

The deployed code did not apply IRS contribution limits, catch-up
contributions, taxes, fees, vesting, loans, or withdrawals. Currency rounding
was display-only; calculations retained floating-point values.
