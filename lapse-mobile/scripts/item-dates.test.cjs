const test = require("node:test");
const assert = require("node:assert/strict");
const {
    dateOnly,
    parseDate,
    nextDueDate,
    daysUntil,
} = require("../src/utils/item-dates.ts");

test("calendar validation rejects impossible dates, not just bad formatting", () => {
    for (const value of [
        "2026-02-30",
        "2026-13-01",
        "2026-2-01",
        "",
        "invalid",
    ])
        assert.equal(parseDate(value), null);
    assert.ok(parseDate("2028-02-29"));
    assert.equal(parseDate("2027-02-29"), null);
});
test("calendar dates use local day, including near midnight in Jakarta", () => {
    const before = process.env.TZ;
    process.env.TZ = "Asia/Jakarta";
    assert.equal(dateOnly(new Date("2026-11-08T18:00:00Z")), "2026-11-09");
    process.env.TZ = before;
});
test("monthly recurrence stays anchored after February", () => {
    assert.equal(
        nextDueDate(
            "2026-01-31",
            { years: 0, months: 1, days: 0 },
            "2026-02-01",
        ),
        "2026-02-28",
    );
    assert.equal(
        nextDueDate(
            "2026-01-31",
            { years: 0, months: 1, days: 0 },
            "2026-03-01",
        ),
        "2026-03-31",
    );
});
test("yearly recurrence restores leap-day anchors", () => {
    assert.equal(
        nextDueDate(
            "2024-02-29",
            { years: 1, months: 0, days: 0 },
            "2025-01-01",
        ),
        "2025-02-28",
    );
    assert.equal(
        nextDueDate(
            "2024-02-29",
            { years: 1, months: 0, days: 0 },
            "2028-01-01",
        ),
        "2028-02-29",
    );
});
test("mixed intervals match the backend year-month-day order", () => {
    assert.equal(
        nextDueDate(
            "2024-02-29",
            { years: 1, months: 1, days: 1 },
            "2025-01-01",
        ),
        "2025-03-29",
    );
});
test("next due includes today and skips old occurrences", () => {
    assert.equal(
        nextDueDate(
            "2026-10-14",
            { years: 0, months: 3, days: 0 },
            "2026-11-09",
        ),
        "2027-01-14",
    );
    assert.equal(
        nextDueDate(
            "2026-10-14",
            { years: 0, months: 3, days: 0 },
            "2027-01-14",
        ),
        "2027-01-14",
    );
});
test("empty, negative, fractional recurrence and invalid anchors are rejected", () => {
    for (const interval of [
        { years: 0, months: 0, days: 0 },
        { years: 0, months: -1, days: 0 },
        { years: 0, months: 1.5, days: 0 },
    ])
        assert.equal(nextDueDate("2026-01-01", interval), null);
    assert.equal(
        nextDueDate("2026-02-30", { years: 0, months: 1, days: 0 }),
        null,
    );
});
test("today has zero calendar days remaining", () =>
    assert.equal(daysUntil(dateOnly()), 0));
