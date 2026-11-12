// Mobile-sized browser regression against isolated API fixtures. Start Expo web and
// a headless Chrome --remote-debugging-port=9222 before running this script.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const output = path.resolve(__dirname, "../.expo/reference-check");
fs.mkdirSync(output, { recursive: true });
const base = process.env.UI_TEST_URL || "http://localhost:8082";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fixtureSetup() {
    localStorage.setItem(
        "lapse.auth.session",
        JSON.stringify({
            accessToken: "test-token",
            refreshToken: "test-refresh",
            user: {
                id: "reference-test",
                name: "Andrew Castello",
                email: "andrew@example.com",
            },
        }),
    );
    const names = ["Identity", "Subscription", "Vehicle", "Legal", "Others"];
    const categories = names.map((name, i) => ({
        id: i + 1,
        name,
        image_path: `master-categories/${name.toLowerCase()}.png`,
    }));
    const masters = [
        "SIM",
        "Netflix",
        "STNK",
        "Insurance",
        "Other document",
    ].map((name, i) => ({
        id: i + 11,
        mc_id: i + 1,
        name,
        image_path: `master-items/${name.toLowerCase().replaceAll(" ", "-")}.png`,
    }));
    window.__requests = [];
    const future = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    window.__tracked = [
        {
            id: 1,
            mi_id: 12,
            mc_id: 2,
            item_name: "Netflix",
            category_name: "Subscription",
            image_path: "master-items/netflix.png",
            expiry_type: "ONCE",
            expiry_date: future(5),
        },
        {
            id: 2,
            mi_id: 11,
            mc_id: 1,
            item_name: "SIM",
            category_name: "Identity",
            image_path: "master-items/sim.png",
            expiry_type: "ONCE",
            expiry_date: future(16),
        },
        {
            id: 3,
            mi_id: 13,
            mc_id: 3,
            item_name: "Pajak Kendaraan",
            category_name: "Vehicle",
            image_path: "master-items/pajak-kendaraan.png",
            expiry_type: "ONCE",
            expiry_date: future(33),
        },
        {
            id: 4,
            mi_id: 13,
            mc_id: 3,
            item_name: "STNK",
            category_name: "Vehicle",
            image_path: "master-items/stnk.png",
            expiry_type: "ONCE",
            expiry_date: future(71),
        },
    ];
    window.__failNextSave = false;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
        const url = new URL(
            typeof input === "string" ? input : input.url,
            location.href,
        );
        const method = init.method || "GET";
        const body = init.body ? JSON.parse(init.body) : undefined;
        let result,
            status = 200;
        const route = url.pathname;
        if (route === "/categories") result = categories;
        else if (route === "/items")
            result = masters.filter(
                (item) =>
                    !url.searchParams.get("categoryId") ||
                    item.mc_id === Number(url.searchParams.get("categoryId")),
            );
        else if (route === "/timeline")
            result = {
                data: window.__tracked
                    .filter(
                        (item) =>
                            item.expiry_type !== "NEVER" &&
                            item.expiry_date >= url.searchParams.get("from") &&
                            item.expiry_date <= url.searchParams.get("to"),
                    )
                    .map((item) => ({
                        userItemId: item.id,
                        categoryId: item.mc_id,
                        itemName: item.item_name,
                        expiryType: item.expiry_type,
                        occurrenceDate: item.expiry_date,
                    })),
            };
        else if (route.startsWith("/user-items")) {
            if (method === "POST" || method === "PATCH") {
                window.__requests.push({ method, body });
                if (window.__failNextSave) {
                    window.__failNextSave = false;
                    return new Response(
                        JSON.stringify({ message: "Test save failed. Retry." }),
                        {
                            status: 500,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }
                const master = masters.find(
                    (item) => item.id === Number(body.miId),
                );
                const existing = window.__tracked.find(
                    (item) => String(item.id) === route.split("/").at(-1),
                );
                const category = categories.find(
                    (item) =>
                        item.id ===
                        (master?.mc_id ?? body.mcId ?? existing?.mc_id),
                );
                result = {
                    ...existing,
                    id: existing?.id ?? window.__tracked.length + 100,
                    mi_id: master?.id ?? existing?.mi_id ?? null,
                    mc_id: category.id,
                    item_name:
                        master?.name ?? body.itemName ?? existing?.item_name,
                    category_name: category.name,
                    image_path: master?.image_path ?? category.image_path,
                    category_image_path: category.image_path,
                    expiry_type: body.expiryType,
                    expiry_date: body.expiryDate ?? null,
                    recurrence_years: body.recurrenceYears ?? null,
                    recurrence_months: body.recurrenceMonths ?? null,
                    recurrence_days: body.recurrenceDays ?? null,
                };
                window.__tracked = window.__tracked
                    .filter((item) => item.id !== result.id)
                    .concat(result);
            } else if (method === "DELETE") {
                window.__requests.push({ method, id: route.split("/").at(-1) });
                window.__tracked = window.__tracked.filter(
                    (item) => String(item.id) !== route.split("/").at(-1),
                );
                result = { deleted: true };
            } else
                result =
                    route === "/user-items"
                        ? window.__tracked
                        : window.__tracked.find(
                              (item) =>
                                  String(item.id) === route.split("/").at(-1),
                          );
        } else return originalFetch(input, init);
        return new Response(JSON.stringify(result), {
            status,
            headers: { "Content-Type": "application/json" },
        });
    };
}
(async () => {
    const targets = await (await fetch("http://localhost:9222/json")).json();
    const target = targets.find((t) => t.type === "page");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) =>
        socket.addEventListener("open", resolve, { once: true }),
    );
    let sequence = 0;
    const pending = new Map();
    const exceptions = [];
    socket.addEventListener("message", ({ data }) => {
        const message = JSON.parse(data);
        if (message.id) {
            const waiter = pending.get(message.id);
            pending.delete(message.id);
            message.error
                ? waiter.reject(new Error(JSON.stringify(message.error)))
                : waiter.resolve(message.result);
        } else if (message.method === "Runtime.exceptionThrown")
            exceptions.push(message.params.exceptionDetails);
        else if (message.method === "Fetch.requestPaused") {
            const { requestId, request } = message.params;
            const parts = new URL(request.url).pathname.split("/");
            const folder = parts.includes("master-categories")
                ? "master-categories-images"
                : "master-items-images";
            const file = path.resolve(
                __dirname,
                "../../lapse-assets",
                folder,
                path.basename(parts.at(-1)),
            );
            if (fs.existsSync(file))
                void call("Fetch.fulfillRequest", {
                    requestId,
                    responseCode: 200,
                    responseHeaders: [
                        { name: "Content-Type", value: "image/png" },
                        { name: "Access-Control-Allow-Origin", value: "*" },
                    ],
                    body: fs.readFileSync(file).toString("base64"),
                });
            else void call("Fetch.continueRequest", { requestId });
        }
    });
    const call = (method, params = {}) =>
        new Promise((resolve, reject) => {
            const id = ++sequence;
            pending.set(id, { resolve, reject });
            socket.send(JSON.stringify({ id, method, params }));
        });
    const evaluate = async (expression) => {
        const result = await call("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });
        if (result.exceptionDetails)
            throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const wait = async (expression, label) => {
        for (let n = 0; n < 180; n++) {
            if (await evaluate(expression)) return;
            await sleep(500);
        }
        throw new Error(
            `Timed out: ${label}\n${await evaluate("document.body.innerText")}`,
        );
    };
    const text = () => evaluate("document.body.innerText");
    const click = async (label) => {
        await wait(
            `Array.from(document.querySelectorAll('[dir="auto"]')).some(el=>el.textContent===${JSON.stringify(label)})`,
            label,
        );
        await evaluate(
            `Array.from(document.querySelectorAll('[dir="auto"]')).find(el=>el.textContent===${JSON.stringify(label)}).click()`,
        );
        await sleep(150);
    };
    const clickAria = async (label) => {
        assert.ok(
            await evaluate(
                `(()=>{const el=document.querySelector('[aria-label="${label}"]');if(!el)return false;el.click();return true;})()`,
            ),
            `Missing control ${label}`,
        );
        await sleep(150);
    };
    const fill = async (label, value) => {
        assert.ok(
            await evaluate(
                `(()=>{const el=document.querySelector('input[aria-label="${label}"]');if(!el)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`,
            ),
            `Missing input ${label}`,
        );
        await sleep(120);
    };
    const shot = async (name) => {
        await sleep(700);
        const { data } = await call("Page.captureScreenshot", {
            format: "png",
        });
        fs.writeFileSync(
            path.join(output, `${name}.png`),
            Buffer.from(data, "base64"),
        );
    };
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Fetch.enable", {
        patterns: [{ urlPattern: "*storage/v1/object/public/lapse-bucket/*" }],
    });
    await call("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
    });
    await call("Page.addScriptToEvaluateOnNewDocument", {
        source: `(${fixtureSetup.toString()})()`,
    });
    await call("Page.navigate", { url: `${base}/add-flow` });
    await wait(
        `document.body.innerText.includes('What are you tracking?')`,
        "category screen",
    );
    await shot("01-category");
    assert.ok(!(await text()).includes("Add a custom item"));
    for (const [index, category] of [
        "Identity",
        "Subscription",
        "Vehicle",
        "Legal",
        "Others",
    ].entries()) {
        await click(category);
        await wait(
            `document.body.innerText.includes('Pick an item')`,
            "item selection",
        );
        if (category === "Subscription") await shot("02-item-selection");
        assert.ok(
            !(await text()).includes("What are you tracking?"),
            "No second category step",
        );
        await click("Add custom item");
        if (index === 0) {
            await click("Continue");
            assert.ok((await text()).includes("Enter an item name."));
        }
        await fill("Item name", `Custom ${category}`);
        if (category === "Subscription") await shot("03-custom-name");
        await click("Continue");
        await wait(
            `document.body.innerText.includes('Expiry type')`,
            "details",
        );
        if (index === 0) {
            await click("Once");
            await fill("Date (YYYY-MM-DD)", "2031-10-15");
            await shot("04-once");
        } else if (index === 1) {
            await click("Recurring");
            await clickAria("Increase months");
            await fill("Date (YYYY-MM-DD)", "2026-10-14");
            await shot("05-recurring");
            await evaluate("window.__failNextSave=true");
            await click("Save item");
            await wait(
                `document.body.innerText.includes('Test save failed')`,
                "failed-save state",
            );
            assert.ok((await text()).includes("Custom Subscription"));
        } else {
            await click("None");
            if (index === 4) await shot("06-no-expiry");
        }
        await click("Save item");
        await wait(`document.body.innerText.includes('Item added')`, "saved");
        if (index === 4) await shot("07-success");
        const request = await evaluate("window.__requests.at(-1)");
        assert.equal(request.body.mcId, index + 1);
        assert.equal(request.body.itemName, `Custom ${category}`);
        if (index < 4) await click("Add another item");
    }
    await click("Add another item");
    await click("Subscription");
    await fill("Search items", "Net");
    assert.ok((await text()).includes("Netflix"));
    await click("Netflix");
    await click("None");
    await click("Save item");
    await wait(
        `document.body.innerText.includes('Item added')`,
        "master saved",
    );
    const master = await evaluate("window.__requests.at(-1)");
    assert.equal(master.body.miId, 12);
    assert.ok(!("mcId" in master.body));
    assert.ok(!("itemName" in master.body));
    await click("Go to items");
    await wait(`document.body.innerText.includes('My Items')`, "items");
    await shot("08-items");
    await click("No Expiry");
    assert.ok((await text()).includes("Custom Others"));
    assert.ok(!(await text()).includes("Custom Identity"));
    await click("All");
    await click("Custom Subscription");
    await wait(`document.body.innerText.includes('Next due date')`, "detail");
    await shot("09-detail");
    await click("Edit");
    await wait(`document.body.innerText.includes('Edit Item')`, "edit");
    await click("None");
    await shot("10-edit");
    await click("Save changes");
    await wait(
        `document.body.innerText.includes('No expiry') && !document.body.innerText.includes('Save changes')`,
        "update",
    );
    assert.equal((await evaluate("window.__requests.at(-1)")).method, "PATCH");
    await click("Edit");
    await clickAria("Delete item");
    await wait(
        `document.body.innerText.includes('Delete this item?')`,
        "delete dialog",
    );
    await shot("11-delete");
    await click("Cancel");
    assert.ok(!(await text()).includes("Delete this item?"));
    await clickAria("Delete item");
    await click("Delete");
    await wait(`document.body.innerText.includes('My Items')`, "deleted");
    assert.equal((await evaluate("window.__requests.at(-1)")).method, "DELETE");
    // Navigate through tab anchors rather than reload so fixture data remains intact.
    await evaluate(`document.querySelector('a[href="/"]')?.click()`);
    await sleep(500);
    await shot("12-home");
    await clickAria("Upcoming date range");
    await click("1 month");
    await wait(
        `!document.body.innerText.includes('Pajak Kendaraan')`,
        "one-month date range",
    );
    assert.ok((await text()).includes("Netflix"));
    assert.ok((await text()).includes("SIM"));
    await clickAria("Upcoming date range");
    await click("3 months");
    await wait(
        `document.body.innerText.includes('Pajak Kendaraan')`,
        "three-month date range",
    );
    await evaluate(`document.querySelector('a[href="/profile"]')?.click()`);
    await wait(
        `document.body.innerText.includes('Profile') && document.body.innerText.includes('Appearance')`,
        "profile",
    );
    await shot("13-profile");
    await click("Appearance");
    await click("Light");
    await shot("14-light");
    assert.ok(
        await evaluate(
            `localStorage.getItem('lapse.preferences.reference-test').includes('Light')`,
        ),
    );
    await click("Dark");
    await shot("15-dark");
    await clickAria("Back"); await click("Notifications");
    await wait(`document.querySelectorAll('[role="switch"]').length === 4`, 'notification switches');
    const beforeNotification = await evaluate(`JSON.parse(localStorage.getItem('lapse.preferences.reference-test')).notifications[0]`);
    await evaluate(`document.querySelector('[role="switch"]').click()`);
    await sleep(200);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lapse.preferences.reference-test')).notifications[0]`), !beforeNotification);
    await shot("16-notifications");
    await clickAria("Back"); await click("Logged in Devices"); await shot("17-devices");
    assert.ok((await text()).includes('This device'));
    await clickAria("Back"); await click("Account Settings");
    await wait(`document.body.innerText.includes('Type') && document.body.innerText.includes('DELETE')`, 'account confirmation');
    await shot("18-account-confirmation");
    await clickAria("Back");
    await evaluate(`document.querySelector('a[href="/add"]')?.click()`);
    await wait(`document.body.innerText.includes('What are you tracking?')`, 'Add tab opens the single category screen');
    assert.equal((await text()).split('What are you tracking?').length-1,1);
    assert.deepEqual(exceptions, [], "No uncaught browser exceptions");
    fs.writeFileSync(
        path.join(output, "requests.json"),
        JSON.stringify(await evaluate("window.__requests"), null, 2),
    );
    console.log(
        "PASS: all five custom categories; ready-made selection; once/recurring/none; failed save and retry; search; no-expiry filter; detail; edit; delete/cancel; profile; appearance. Screenshots: " +
            output,
    );
    socket.close();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
