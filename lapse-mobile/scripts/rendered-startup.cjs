// Uses a real API on :3100 backed by rollback-only PostgreSQL fixtures.
// Start scripts/ui-api.mjs in lapse-api, Expo web on :8082 and Chrome CDP :9222.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const out = path.resolve(__dirname, "../.expo/startup-check"),
  base = process.env.UI_TEST_URL || "http://localhost:8082";
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  // A real TCP endpoint that accepts connections without responding reproduces
  // the unreachable-LAN timeout without mocking application API responses.
  const sockets = new Set();
  const blackhole = require("node:net").createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => blackhole.listen(59999, "127.0.0.1", resolve));
  const target = await fetch(
    "http://localhost:9222/json/new?" + encodeURIComponent(base),
    { method: "PUT" },
  ).then((r) => r.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) =>
    ws.addEventListener("open", resolve, { once: true }),
  );
  let nextId = 0;
  const pending = new Map(),
    errors = [];
  ws.addEventListener("message", (message) => {
    const data = JSON.parse(message.data);
    if (data.id) {
      const promise = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) promise?.reject(new Error(data.error.message));
      else promise?.resolve(data.result);
    } else if (data.method === "Runtime.exceptionThrown")
      errors.push(
        data.params.exceptionDetails.exception?.description ??
          data.params.exceptionDetails.text,
      );
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(
        () => {
          pending.delete(id);
          reject(new Error("CDP timeout: " + method));
        },
        method === "Page.navigate" ? 60000 : 20000,
      );
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const text = () => evaluate("document.body.innerText");
  async function wait(expression, label, timeout = 45000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await evaluate(expression)) return;
      await sleep(180);
    }
    throw new Error(
      "Timed out: " + label + "; " + (await text()).slice(0, 1500),
    );
  }
  async function click(label) {
    await wait(
      'Array.from(document.querySelectorAll("[role=button],[role=tab],[role=radio],button,a")).some(e=>e.innerText.trim().split("\\n")[0]===' +
        JSON.stringify(label) +
        ")",
      "button " + label,
    );
    const result = await evaluate(
      '(()=>{const e=Array.from(document.querySelectorAll("[role=button],[role=tab],[role=radio],button,a")).find(e=>e.innerText.trim().split("\\n")[0]===' +
        JSON.stringify(label) +
        ");e?.click();return !!e})()",
    );
    assert.ok(result);
    await sleep(250);
  }
  async function aria(label) {
    const selector = "[aria-label=" + JSON.stringify(label) + "]";
    await wait(
      "!!document.querySelector(" + JSON.stringify(selector) + ")",
      "control " + label,
    );
    await evaluate(
      "document.querySelector(" + JSON.stringify(selector) + ").click()",
    );
    await sleep(250);
  }
  async function fill(label, value) {
    const selector = "input[aria-label=" + JSON.stringify(label) + "]";
    await wait(
      "!!document.querySelector(" + JSON.stringify(selector) + ")",
      "input " + label,
    );
    await evaluate(
      "(()=>{const e=document.querySelector(" +
        JSON.stringify(selector) +
        ');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,' +
        JSON.stringify(value) +
        ');e.dispatchEvent(new Event("input",{bubbles:true}));})()',
    );
    await sleep(100);
  }
  async function shot(name) {
    await wait(
      "Array.from(document.images).filter(image=>{const rect=image.getBoundingClientRect();return rect.top<innerHeight&&rect.bottom>0;}).every(image=>image.complete)",
      "image loading",
      20000,
    ).catch(() => console.log("Artwork is still loading from storage"));
    await sleep(400);
    const image = await cdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      path.join(out, name + ".png"),
      Buffer.from(image.data, "base64"),
    );
    console.log("Rendered " + name);
  }
  async function navigate(route) {
    await cdp("Page.navigate", { url: base + route });
    await sleep(400);
  }
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Network.enable");
  const apiRequests = [];
  ws.addEventListener("message", (event) => {
    const row = JSON.parse(event.data);
    if (
      row.method === "Network.requestWillBeSent" &&
      row.params.request.url.includes(":59999")
    )
      apiRequests.push(row.params.request);
  });
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await navigate("/");
  await evaluate("localStorage.clear()");
  await navigate("/");
  await wait(
    'document.body.innerText.includes("Sign in to your account")',
    "offline login loads",
  );
  assert.equal(
    apiRequests.length,
    0,
    "anonymous startup must not contact backend",
  );
  assert.ok(!(await text()).includes("Unable to connect"));
  await shot("01-offline-login");
  await fill("Email", "offline@example.test");
  await fill("Password", "keep-entered-password");
  await click("Sign in");
  await wait(
    'document.querySelector("[role=button][aria-disabled=true]")!==null',
    "credential submission loading",
  );
  await wait(
    'document.body.innerText.includes("Unable to connect to the server. Please try again.")',
    "bounded login error",
    20000,
  );
  assert.equal(
    await evaluate('document.querySelector("input[aria-label=Email]").value'),
    "offline@example.test",
  );
  assert.equal(
    await evaluate(
      'document.querySelector("input[aria-label=Password]").value',
    ),
    "keep-entered-password",
  );
  assert.equal(
    apiRequests.filter((row) => row.method === "POST").length,
    1,
    "no automatic credential POST retries",
  );
  await shot("02-offline-login-error");
  const stored = {
    accessToken: "offline-access",
    refreshToken: "offline-refresh",
    user: {
      id: "6ee52d37-2bd4-4bba-b44e-656ebd6274d3",
      name: "Offline User",
      email: "offline@example.test",
      timezone: "Asia/Bangkok",
    },
  };
  await evaluate(
    'localStorage.setItem("lapse.auth.session",' +
      JSON.stringify(JSON.stringify(stored)) +
      ');localStorage.setItem("lapse.tour.v2.' +
      stored.user.id +
      '._.","done")',
  );
  await navigate("/");
  await wait(
    'document.body.innerText.includes("Good ")',
    "stored session renders without waiting for backend",
  );
  if ((await text()).includes("A quick look around?")) await click("Skip");
  assert.ok(!(await text()).includes("Help & tour"));
  assert.ok(!(await text()).includes("Help Center"));
  await shot("03-offline-home");
  await navigate("/preferences");
  await wait(
    'document.body.innerText.includes("Help & Support")',
    "settings support row",
  );
  const body = await text();
  assert.ok(body.indexOf("Help & Support") > body.indexOf("About Lapse"));
  assert.ok(body.indexOf("Help & Support") < body.indexOf("Sign out"));
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 640,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(
    'Array.from(document.querySelectorAll("div")).filter(e=>e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==="auto").forEach(e=>e.scrollTop=e.scrollHeight)',
  );
  await shot("04-small-settings");
  const bounds = await evaluate(
    '(()=>{const sign=Array.from(document.querySelectorAll("[role=button]")).find(e=>e.innerText.trim()==="Sign out");const tab=document.querySelector("[role=tablist]");return {sign:sign?.getBoundingClientRect().bottom,tab:tab?.getBoundingClientRect().top};})()',
  );
  assert.ok(
    bounds.sign && bounds.tab && bounds.sign <= bounds.tab,
    "last content must scroll above bottom navigation",
  );
  await click("Help & Support");
  await wait(
    'document.body.innerText.includes("Search offline help")',
    "support navigates",
  );
  await navigate("/settings?section=password");
  await shot("05-small-password");
  await navigate("/settings?section=notifications");
  await wait(
    'document.body.innerText.includes("Send test push notification")',
    "remote test button",
  );
  await shot("06-test-push-settings");
  await click("Send test push notification");
  await wait(
    'document.body.innerText.includes("development build")',
    "unsupported web test remains safe",
  );
  await navigate("/settings?section=appearance");
  await click("Dark");
  await navigate("/preferences");
  await shot("07-small-dark-settings");
  await sleep(18000);
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("lapse.auth.session")).refreshToken',
    ),
    "offline-refresh",
    "network failures must not clear sessions",
  );
  assert.deepEqual(errors, [], "no uncaught browser exceptions");
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        screenshots: 7,
        viewports: ["390x844", "320x640"],
        api: "real nonresponding TCP endpoint localhost:59999",
        assertions:
          "anonymous no-fetch, bounded login, input retention, one POST, stored session startup, support placement, scroll/tab bounds, push UI, dark mode, session retention",
        exceptions: errors,
      },
      null,
      2,
    ),
  );
  console.log("PASS startup, offline auth and layout browser checks");
  ws.close();
  for (const socket of sockets) socket.destroy();
  blackhole.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
