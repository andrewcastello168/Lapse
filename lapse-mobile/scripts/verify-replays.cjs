// Uses a real API on :3100 backed by rollback-only PostgreSQL fixtures.
// Start scripts/ui-api.mjs in lapse-api, Expo web on :8082 and Chrome CDP :9222.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const out = path.resolve(__dirname, "../.expo/ui-phase2"),
  base = process.env.UI_TEST_URL || "http://localhost:8082";
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../.expo/ui-check/state.json"), "utf8"),
);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
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
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const cases = [
    ["Replay adding items tour", "add-flow"],
    ["Replay calendar tour", "calendar"],
    ["Replay notification settings tour", "settings"],
    ["Replay item details and renewal tour", "item/"],
  ];
  for (const [label, route] of cases) {
    await navigate("/help");
    await wait(
      "document.body.innerText.includes(" + JSON.stringify(label) + ")",
      "replay link",
    );
    await click(label);
    await wait(
      "location.pathname.includes(" + JSON.stringify(route) + ")",
      "target route",
    );
    await wait('document.body.innerText.includes("Close")', "replay opened");
    await click("Close");
    console.log("PASS " + label);
  }
  assert.deepEqual(errors, []);
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
