// Uses a real API on :3100 backed by rollback-only PostgreSQL fixtures.
// Start scripts/ui-api.mjs in lapse-api, Expo web on :8082 and Chrome CDP :9222.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const out = path.resolve(__dirname, "../.expo/device-qa"),
  base = process.env.UI_TEST_URL || "http://localhost:8082";
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../.expo/ui-check/state.json"), "utf8"),
);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  // Old tabs can run auth refreshes for rolled-back fixtures and clear shared
  // browser storage during a new run. This is a dedicated QA Chrome profile.
  const previous = await fetch("http://localhost:9222/json/list").then((r) =>
    r.json(),
  );
  for (const page of previous.filter(
    (page) => page.type === "page" && page.url.startsWith(base),
  ))
    await fetch("http://localhost:9222/json/close/" + page.id);
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
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
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
      'Array.from(document.querySelectorAll("[role=button],[role=tab],[role=radio],[role=checkbox],button,a")).some(e=>e.innerText.trim().split("\\n")[0]===' +
        JSON.stringify(label) +
        ")",
      "button " + label,
    );
    const result = await evaluate(
      '(()=>{const e=Array.from(document.querySelectorAll("[role=button],[role=tab],[role=radio],[role=checkbox],button,a")).find(e=>e.innerText.trim().split("\\n")[0]===' +
        JSON.stringify(label) +
        ");if(!e)return false;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight+1)throw new Error('Control outside scroll viewport');e.click();return true})()",
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
  console.log("Browser connected; checking rendered screens.");
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp("Page.navigate", { url: base });
  await wait("location.origin===" + JSON.stringify(base), "origin");
  await evaluate("localStorage.clear()");
  await navigate("/auth?mode=signin");
  await fill("Email", fixture.email);
  await fill("Password", fixture.password);
  await click("Sign in");
  await wait('document.body.innerText.includes("Total items")', "dashboard");
  await sleep(600);
  if ((await text()).includes("A quick look around?")) await click("Skip");
  await shot("01-home-light");
  await navigate("/item/" + fixture.manualId);
  await wait(
    'document.body.innerText.includes("Use account defaults")',
    "item reminder load",
  );
  assert.ok(!(await text()).includes("? Use account defaults"));
  await click("Choose reminders");
  await click("14 days before");
  await click("Save item reminders");
  await wait(
    'document.body.innerText.includes("Reminders saved")',
    "item reminder saved",
  );
  await shot("02-detail-reminders");
  await click("Edit item");
  for (let n = 0; n < 2; n++) {
    await aria("Set recurrence");
    await fill("years", "1");
    await fill("months", "1");
    await fill("days", "2");
    await cdp("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 400,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await shot("03-recurrence-short-" + n);
    await click("Cancel");
    await cdp("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
  }
  await navigate("/calendar");
  await wait(
    'document.body.innerText.includes("occurrences across")',
    "calendar",
  );
  const monthText = () =>
    evaluate(
      `document.querySelector('[aria-label="Choose month and year"]').innerText`,
    );
  const original = await monthText();
  await aria("Next month");
  await wait(
    'document.body.innerText.includes("occurrences across")',
    "next month loaded",
  );
  assert.notEqual(await monthText(), original);
  await aria("Previous month");
  assert.equal(await monthText(), original);
  await aria("Choose month and year");
  await click(String(new Date().getFullYear()));
  await click("2027");
  await click("July");
  await wait(
    'document.body.innerText.includes("July 2027")',
    "month/year selection",
  );
  await wait(
    'document.body.innerText.includes("occurrences across")',
    "month loaded",
  );
  await shot("04-calendar-july");
  const swipe = async (from, to) => {
    await cdp("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from, y: 240 }],
    });
    for (let n = 1; n <= 8; n++) {
      await cdp("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from + ((to - from) * n) / 8, y: 240 }],
      });
      await sleep(30);
    }
    await cdp("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await sleep(600);
  };
  await swipe(320, 50);
  await shot("04-after-swipe");
  assert.ok((await monthText()).includes("August"), "calendar swipe left");
  await swipe(50, 320);
  await shot("04-after-swipe-right");
  assert.ok((await monthText()).includes("July"), "calendar swipe right");
  await navigate("/settings?section=timezone");
  await fill("Find a timezone", "Beijing");
  await click("Asia/Shanghai");
  await shot("05-timezone-alias");
  await fill("Find a timezone", "New York");
  await click("America/New York");
  await navigate("/settings?section=timezone");
  assert.ok((await text()).includes("Selected: America/New York"));
  await click("Automatic timezone");
  await navigate("/settings?section=reminder");
  assert.ok((await text()).includes("On the due date"));
  await click("Reminder time");
  await click("17:00");
  assert.ok((await text()).includes("17:00"));
  await shot("06-default-reminders");
  await navigate("/settings?section=notifications");
  assert.ok(
    !(await text()).includes("Send test push notification"),
    "production hides development tools",
  );
  await shot("07-notification-settings");
  for (const mode of ["Light", "Dark"]) {
    await navigate("/settings?section=appearance");
    await click(mode);
    await cdp("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 640,
      deviceScaleFactor: 1,
      mobile: true,
    });
    for (const [name, route] of [
      ["calendar", "/calendar"],
      ["detail", "/item/" + fixture.manualId],
      ["reminders", "/settings?section=reminder"],
      ["password", "/settings?section=password"],
      ["settings", "/preferences"],
      ["items", "/items"],
      ["help", "/help"],
    ]) {
      await navigate(route);
      await sleep(300);
      await shot("08-small-" + mode + "-" + name);
      assert.ok(
        await evaluate(
          "document.documentElement.scrollWidth<=window.innerWidth+1",
        ),
        "no horizontal document overflow: " + route,
      );
    }
  }
  assert.deepEqual(errors, [], "No uncaught browser exceptions");
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        screenshots: fs.readdirSync(out).filter((n) => n.endsWith(".png"))
          .length,
        physicalDeviceVerified: false,
        api: "Real NestJS/PostgreSQL rollback fixtures; unreachable Edge endpoint",
        exceptions: errors,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS browser QA: calendar swipes/month-year, reminder saving/time, timezone aliases/persistence, light/dark small screens; not physical Android verification",
  );
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
