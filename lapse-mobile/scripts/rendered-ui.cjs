// Uses a real API on :3100 backed by rollback-only PostgreSQL fixtures.
// Start scripts/ui-api.mjs in lapse-api, Expo web on :8082 and Chrome CDP :9222.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const out = path.resolve(__dirname, "../.expo/ui-check"),
  base = process.env.UI_TEST_URL || "http://localhost:8082";
const fixture = JSON.parse(
  fs.readFileSync(path.join(out, "state.json"), "utf8"),
);
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
  console.log("Browser connected; checking rendered screens.");
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp("Page.navigate", { url: base });
  await wait("location.origin===" + JSON.stringify(base), "page origin");
  await evaluate('localStorage.removeItem("lapse.auth.session")');
  await navigate("/");
  await wait('document.body.innerText.includes("Get started")', "welcome");
  await shot("01-welcome");
  await click("Get started");
  await shot("02-introduction");
  await click("I already have an account");
  await fill("Email", fixture.email);
  await fill("Password", fixture.password);
  await shot("03-login");
  await click("Sign in");
  await wait('document.body.innerText.includes("Total items")', "dashboard");
  await shot("04-home-light");
  assert.ok((await text()).includes("Overdue"));
  await click("All");
  await shot("05-all-items-window");
  await navigate("/items");
  await wait('document.body.innerText.includes("No expiry")', "items");
  await shot("06-items");
  await click("Overdue");
  await shot("07-overdue-filter");
  await click("All");
  await fill("Search items", "Passport");
  await shot("08-search");
  assert.ok(!(await text()).includes("Spotify"));
  await fill("Search items", "");
  await navigate("/item/" + fixture.manualId);
  await wait(
    'document.body.innerText.includes("Mark as renewed")',
    "manual detail",
  );
  await shot("09-manual-overdue");
  await click("Mark as renewed");
  await shot("10-renew-confirmation");
  await click("Confirm renewal");
  await wait(
    '!document.body.innerText.includes("Confirm renewal")',
    "renewal saved",
  );
  assert.ok(!(await text()).includes("7 days overdue"));
  await click("Edit item");
  await aria("Set recurrence");
  await fill(
    "months",
    String(
      Number(
        await evaluate(
          "document.querySelector('input[aria-label=months]').value",
        ),
      ) + 1,
    ),
  );
  await shot("11-recurrence-sheet");
  await click("Apply");
  await click("Save changes");
  await wait(
    'document.body.innerText.includes("Reset renewal confirmation?")',
    "confirmation reset",
  );
  await shot("12-schedule-reset");
  await click("Reset and save");
  await wait('!document.body.innerText.includes("Save changes")', "edit saved");
  await navigate("/add-flow");
  await wait(
    'document.body.innerText.includes("Choose a category")',
    "category picker",
  );
  await shot("13-categories");
  await click("Subscription");
  await wait(
    'document.body.innerText.includes("Create custom item")',
    "master picker",
  );
  await shot("14-master-picker");
  await click("Create custom item");
  await fill("Item name", "UI custom subscription");
  await click("Continue");
  await click("Recurring");
  await fill("Date (YYYY-MM-DD)", "2026-12-07");
  await aria("Set recurrence");
  await fill("years", "1");
  await fill("months", "1");
  await fill("days", "2");
  await click("Apply");
  await shot("15-create-combined");
  await click("Create item");
  await wait(
    'document.body.innerText.includes("You’re all set.")',
    "item created",
  );
  await shot("16-created");
  await click("View item");
  await wait(
    'document.body.innerText.includes("UI custom subscription")',
    "custom detail",
  );
  await shot("17-automatic-detail");
  await aria("Delete item");
  await shot("18-delete-confirmation");
  await click("Cancel");
  await aria("Delete item");
  await click("Delete item");
  await wait('document.body.innerText.includes("My items")', "item deleted");
  await navigate("/calendar");
  await wait(
    'document.body.innerText.includes("occurrences across")',
    "calendar",
  );
  await shot("19-calendar");
  await navigate("/timeline");
  await wait('document.body.innerText.includes("unique items")', "timeline");
  await shot("20-timeline");
  await navigate("/notifications");
  await wait(
    'document.body.innerText.includes("Manage reminders")',
    "notifications",
  );
  await shot("21-notifications");
  await navigate("/preferences");
  await wait(
    'document.body.innerText.includes("Default reminder")',
    "settings",
  );
  await shot("22-settings");
  await click("Appearance");
  await click("Dark");
  await shot("23-dark-appearance");
  await navigate("/");
  await wait('document.body.innerText.includes("Total items")', "dark home");
  await shot("24-home-dark");
  await navigate("/preferences");
  await click("Appearance");
  await click("Light");
  await navigate("/settings?section=profile");
  await shot("25-profile");
  await navigate("/settings?section=timezone");
  await fill("Selected timezone", "America/New_York");
  await click("Save timezone");
  await wait(
    'document.body.innerText.includes("Timezone updated")',
    "timezone saved",
  );
  await shot("26-timezone");
  await navigate("/settings?section=notifications");
  await shot("27-reminder-settings");
  await navigate("/settings?section=reminder");
  await shot("28-reminder-offset");
  await navigate("/auth?mode=forgot");
  await wait(
    'document.body.innerText.includes("Send reset link")',
    "reset screen",
  );
  await shot("29-forgot-password");
  assert.deepEqual(errors, [], "No uncaught browser exceptions");
  const report = {
    screenshots: 29,
    viewport: { width: 390, height: 844 },
    api: "Real NestJS + PostgreSQL rollback transaction",
    exceptions: errors,
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("PASS rendered UI flows with real API");
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
