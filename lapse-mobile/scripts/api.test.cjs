const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
function loadApi(fetch) {
  const exports = {},
    writes = [];
  const source = ts.transpileModule(
    fs.readFileSync(require.resolve("../src/services/api.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    require: () => ({
      writeSession: async (value) => writes.push(value),
      clearSession: async () => {},
    }),
    process: { env: { EXPO_PUBLIC_API_URL: "https://api.example.test" } },
    fetch,
    Intl,
    URLSearchParams,
    Set,
    Error,
    Promise,
  });
  exports.setSession({
    accessToken: "old-access",
    refreshToken: "old-refresh",
    user: { id: "owner", name: "User", email: "user@example.test" },
  });
  return { api: exports.api, exports, writes };
}
const response = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});
test("a profile edit during refresh preserves both the latest profile and rotated tokens", async () => {
  let resume;
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  const loaded = loadApi(async (url, init) =>
    url.endsWith("/auth/refresh")
      ? (await gate,
        response(200, {
          accessToken: "new-access",
          refreshToken: "new-refresh",
        }))
      : init.headers.Authorization === "Bearer new-access"
        ? response(200, [])
        : response(401, { message: "Expired" }),
  );
  const request = loaded.api.userItems();
  await new Promise((resolve) => setImmediate(resolve));
  loaded.exports.setSession({
    ...loaded.exports.getSession(),
    user: { id: "owner", name: "Updated name", email: "user@example.test" },
  });
  resume();
  await request;
  assert.equal(loaded.exports.getSession().user.name, "Updated name");
  assert.equal(loaded.exports.getSession().refreshToken, "new-refresh");
});
test("simultaneous expired requests rotate one refresh token", async () => {
  let refreshes = 0;
  const { api, writes } = loadApi(async (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(200, {
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
    }
    return init.headers.Authorization === "Bearer new-access"
      ? response(200, [])
      : response(401, { message: "Expired" });
  });
  await Promise.all([api.userItems(), api.categories()]);
  assert.equal(refreshes, 1);
  assert.equal(writes.length, 1);
});
test("a late refresh cannot restore a logged-out account", async () => {
  let resume;
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  const loaded = loadApi(async (url) =>
    url.endsWith("/auth/refresh")
      ? (await gate, response(200, { accessToken: "new", refreshToken: "new" }))
      : response(401, { message: "Expired" }),
  );
  const request = loaded.api.userItems().catch(() => {});
  await new Promise((resolve) => setImmediate(resolve));
  loaded.exports.setSession(null);
  resume();
  await request;
  assert.equal(loaded.exports.getSession(), null);
  assert.equal(loaded.writes.length, 0);
});
