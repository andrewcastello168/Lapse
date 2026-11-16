const test = require("node:test");
const assert = require("node:assert/strict");
const {
  reminderDiff,
  reminderFingerprint,
} = require("../src/services/reminder-diff.ts");
const row = {
  id: "owner:item:2026-12-01:7",
  itemId: "item",
  itemName: "Passport",
  occurrenceDate: "2026-12-01",
  offset: 7,
  scheduledAt: "2026-11-24T02:00:00Z",
};
test("reconciliation is idempotent and preserves unrelated OS notifications", () => {
  assert.deepEqual(
    reminderDiff(
      [
        { id: "lapse:" + row.id, fingerprint: reminderFingerprint(row) },
        { id: "other-app" },
      ],
      [row],
    ),
    { cancel: [], schedule: [] },
  );
});
test("edits reschedule and deletes or signout cancel old reminders", () => {
  const current = [
      { id: "lapse:" + row.id, fingerprint: reminderFingerprint(row) },
    ],
    changed = { ...row, scheduledAt: "2026-11-24T03:00:00Z" };
  assert.deepEqual(reminderDiff(current, [changed]), {
    cancel: ["lapse:" + row.id],
    schedule: [changed],
  });
  assert.deepEqual(reminderDiff(current, []), {
    cancel: ["lapse:" + row.id],
    schedule: [],
  });
});
test("renewal replaces obsolete keys and delivered reminders do not replay", () => {
  const next = { ...row, id: "owner:item:2027-12-01:3", offset: 3 };
  assert.deepEqual(reminderDiff([{ id: "lapse:" + row.id }], [next]), {
    cancel: ["lapse:" + row.id],
    schedule: [next],
  });
  assert.deepEqual(reminderDiff([], [row], [row.id]), {
    cancel: [],
    schedule: [],
  });
});
