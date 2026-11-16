const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  parseDate,
  formatDate,
  intervalLabel,
} = require("../src/utils/item-dates.ts");
test("forms validate calendar dates and leap dates", () => {
  for (const value of ["2026-02-30", "2026-13-01", "2027-02-29", "invalid", ""])
    assert.equal(parseDate(value), null);
  assert.ok(parseDate("2028-02-29"));
});
test("date and interval presentation does not calculate expiration", () => {
  assert.equal(formatDate("2026-11-07"), "7 Nov 2026");
  assert.equal(
    intervalLabel({ years: 1, months: 1, days: 2 }),
    "1 year, 1 month, 2 days",
  );
});
