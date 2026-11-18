const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  reminderOffsetsOf,
  resolveTimezone,
} = require("../src/utils/preferences.ts");
test("single reminder preferences migrate without resetting selected offsets", () => {
  assert.deepEqual(reminderOffsetsOf({ reminderOffset: 30 }), [30]);
  assert.deepEqual(reminderOffsetsOf({}), [7, 1, 0]);
  assert.deepEqual(
    reminderOffsetsOf({ reminderOffsets: [7, 7, 14, 0, 999] }),
    [7, 14, 0],
  );
  assert.deepEqual(reminderOffsetsOf({ reminderOffset: 999 }), [7, 1, 0]);
});
test("automatic timezone follows device changes and legacy manual overrides persist", () => {
  assert.equal(
    resolveTimezone(
      { timezoneMode: "automatic", timezone: "UTC" },
      "Asia/Kathmandu",
    ).timezone,
    "Asia/Kathmandu",
  );
  assert.equal(
    resolveTimezone({ timezoneMode: "automatic" }, "America/New_York").timezone,
    "America/New_York",
  );
  assert.deepEqual(resolveTimezone({ timezone: "Asia/Bangkok" }, "UTC"), {
    timezone: "Asia/Bangkok",
    mode: "manual",
  });
  assert.equal(
    resolveTimezone({ timezone: "Invalid/Zone" }, "UTC").timezone,
    "UTC",
  );
});
