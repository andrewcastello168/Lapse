const test = require("node:test");
const assert = require("node:assert/strict");
const { tourKey, tourExplanation } = require("../src/utils/guidance.ts");
test("tutorial completion is versioned, per-account and shared across item details", () => {
  assert.notEqual(tourKey("a", "/"), tourKey("b", "/"));
  assert.equal(tourKey("a", "/item/one"), tourKey("a", "/item/two"));
  assert.notEqual(
    tourKey("a", "/settings", "notifications"),
    tourKey("a", "/settings", "timezone"),
  );
  assert.match(tourKey("a", "/"), /v2/);
});
test("contextual help preserves renewal and no-expiry rules", () => {
  assert.match(
    tourExplanation("Manual renewal"),
    /may still leave the item overdue/,
  );
  assert.match(tourExplanation("Expiration date"), /NEVER has no expiration/);
  assert.match(tourExplanation("Combined recurrence"), /31 March/);
  assert.match(tourExplanation("Timezone"), /without GPS/);
});
