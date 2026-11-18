const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
const source = ts.transpileModule(
  fs.readFileSync(require.resolve("../src/utils/timezones.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  },
).outputText;
function load(runtime) {
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: () => require("../src/constants/timezones.json"),
    Intl: runtime,
    Date,
    Set,
  });
  return exports;
}
test("timezone catalogue survives absent, incomplete and throwing Hermes enumeration", () => {
  for (const supportedValuesOf of [
    undefined,
    () => ["Asia/Jakarta", "UTC"],
    () => {
      throw new Error("unsupported");
    },
  ]) {
    const zones = load({
      DateTimeFormat: Intl.DateTimeFormat,
      supportedValuesOf,
    }).timezoneCatalogue();
    assert.ok(zones.length > 400);
    for (const zone of [
      "America/New_York",
      "Europe/London",
      "Asia/Kathmandu",
      "Pacific/Auckland",
      "Africa/Cairo",
      "UTC",
    ])
      assert.ok(zones.includes(zone));
  }
});
test("timezone search supports spaces, region, identifier and useful city aliases", () => {
  const { searchTimezones, timezoneCatalogue } = load(Intl),
    zones = timezoneCatalogue();
  for (const [query, zone] of [
    ["New York", "America/New_York"],
    ["Bali", "Asia/Makassar"],
    ["UK", "Europe/London"],
    ["Beijing", "Asia/Shanghai"],
    ["GMT", "UTC"],
    ["Asia/Kathmandu", "Asia/Kathmandu"],
  ])
    assert.ok(searchTimezones(zones, query).includes(zone));
  assert.ok(searchTimezones(zones, "not a real city").length === 0);
});
test("timezone offsets use the date's DST and fractional offsets", () => {
  const { timezoneOffset } = load(Intl);
  assert.equal(
    timezoneOffset("America/New_York", new Date("2026-01-15T12:00:00Z")),
    "GMT-5",
  );
  assert.equal(
    timezoneOffset("America/New_York", new Date("2026-07-15T12:00:00Z")),
    "GMT-4",
  );
  assert.equal(timezoneOffset("Asia/Kathmandu"), "GMT+5:45");
  assert.equal(timezoneOffset("Invalid/Zone"), "Offset unavailable");
});
test("offset formatting works when Hermes lacks shortOffset", () => {
  function DateTimeFormat(locale, options) {
    if (options?.timeZoneName === "shortOffset")
      throw new RangeError("unsupported");
    return new Intl.DateTimeFormat(locale, options);
  }
  const { timezoneOffset } = load({ DateTimeFormat });
  assert.equal(
    timezoneOffset("Asia/Kathmandu", new Date("2026-07-15T12:00:00Z")),
    "GMT+5:45",
  );
  assert.equal(
    timezoneOffset("America/New_York", new Date("2026-01-15T12:00:00Z")),
    "GMT-5",
  );
});
