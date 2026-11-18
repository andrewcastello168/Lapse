const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
function loadApi(fetch, timer = setTimeout) {
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
    process: {
      env: {
        EXPO_PUBLIC_API_URL: "https://api.example.test",
        EXPO_PUBLIC_SUPABASE_URL: "https://edge.example.test",
      },
    },
    fetch,
    AbortController,
    setTimeout: timer,
    clearTimeout,
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

test("unreachable login has a finite timeout, never retries credentials, and retains the session", async () => {
  let attempts = 0;
  const loaded = loadApi(
    () => {
      attempts++;
      return new Promise(() => {});
    },
    (fn) => setTimeout(fn, 1),
  );
  await assert.rejects(
    loaded.api.login({
      email: "user@example.test",
      password: "entered-password",
    }),
    /Unable to connect to the server. Please try again./,
  );
  assert.equal(attempts, 1);
  assert.equal(loaded.exports.getSession().user.id, "owner");
});
test("safe reads retry once on a transient connection failure", async () => {
  let calls = 0;
  const loaded = loadApi(async () => {
    if (++calls === 1) throw new Error("offline");
    return response(200, []);
  });
  assert.deepEqual(Array.from(await loaded.api.userItems()), []);
  assert.equal(calls, 2);
});
test("network failure during refresh never clears stored authentication", async () => {
  const loaded = loadApi(async (url) => {
    if (url.endsWith("/auth/refresh")) throw new Error("offline");
    return response(401, {});
  });
  await assert.rejects(loaded.api.me(), /Unable to connect to the server/);
  assert.equal(loaded.exports.getSession().refreshToken, "old-refresh");
});
test("Edge notification actions share refresh rotation and retain the original mutation ID", async () => {
  const calls = [];
  const loaded = loadApi(async (url, init) => {
    calls.push({ url, ...init });
    if (url.endsWith("/auth/refresh"))
      return response(200, { accessToken: "new", refreshToken: "rotated" });
    return init.headers.Authorization === "Bearer new"
      ? response(200, { saved: true })
      : response(401, { message: "Expired" });
  });
  await loaded.exports.notificationRequest("test", { requestId: "same-id" });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].body, calls[2].body);
  assert.ok(calls[2].url.startsWith("https://edge.example.test"));
  assert.equal(loaded.exports.getSession().refreshToken, "rotated");
});
test("Edge server errors and null error bodies are not authentication failures", async () => {
  for (const status of [503, 502, 404]) {
    let calls = 0;
    const loaded = loadApi(async () => {
      calls++;
      return response(status, null);
    });
    await assert.rejects(
      loaded.api.notificationPreferences(),
      (error) => error.status === status,
    );
    assert.equal(calls, 1);
    assert.equal(loaded.exports.getSession().refreshToken, "old-refresh");
  }
});
test("re-saving a persisted item reminder never sends read-only ownership fields", async () => {
  let saved;
  const loaded = loadApi(async (_url, init) => {
    if (init.method === "PATCH") {
      saved = JSON.parse(init.body);
      return response(200, saved);
    }
    return response(200, {
      user_id: "owner",
      item_id: "item",
      mode: "OVERRIDE",
      offsets: [14, 0],
    });
  });
  const value = await loaded.api.itemNotificationPreferences("item");
  await loaded.api.saveItemNotificationPreferences("item", value);
  assert.deepEqual(saved, { mode: "OVERRIDE", offsets: [14, 0] });
});
test("rapid notification changes save in order and queued writes cannot cross accounts", async () => {
  let release;
  const first = new Promise((resolve) => {
    release = resolve;
  });
  const hours = [];
  const loaded = loadApi(async (_url, init) => {
    const hour = JSON.parse(init.body).preferences.hour;
    hours.push(hour);
    if (hour === 9) await first;
    return response(200, { saved: true });
  });
  const body = { enabled: true, offsets: [7, 1, 0], hour: 9, timezone: "UTC" };
  const a = loaded.api.saveNotificationPreferences(body);
  const b = loaded.api.saveNotificationPreferences({ ...body, hour: 17 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(hours, [9]);
  release();
  await Promise.all([a, b]);
  assert.deepEqual(hours, [9, 17]);
  const queued = loaded.api.saveNotificationPreferences(body);
  loaded.exports.setSession(null);
  await assert.rejects(queued, /session changed/);
  assert.deepEqual(hours, [9, 17]);
});
