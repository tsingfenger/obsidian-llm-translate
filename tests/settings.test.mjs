import assert from "node:assert/strict";
import { test } from "node:test";
import { loadModule, settingsApi, apiResponse, deferred, flush, fakeClock, completedResponse } from "./helpers.mjs";

function setup(requestUrl, saved = { apiKey: "test-key" }) {
  const obsidian = settingsApi(requestUrl);
  const clock = fakeClock();
  const { DEFAULT_SETTINGS, TranslateSettingTab } = loadModule("src/settings.ts", obsidian, clock);
  const plugin = {
    settings: { ...DEFAULT_SETTINGS, ...saved },
    saves: [],
    async saveSettings() { this.saves.push({ ...this.settings }); },
    updateRibbonIcon() {},
  };
  const tab = new TranslateSettingTab({}, plugin);
  const setting = (prefix) => {
    const found = tab.containerEl.settings.find((setting) => setting.name.startsWith(prefix));
    assert.ok(found, `Setting ${prefix} should exist`);
    return found;
  };
  const control = (prefix, kind) => {
    const found = setting(prefix).controls.find((control) => control.kind === kind);
    assert.ok(found, `${prefix} should have a ${kind} control`);
    return found;
  };
  const models = () => [...control("Available models", "dropdown").options.keys()].filter(Boolean);
  return { tab, plugin, clock, setting, control, models, notices: obsidian.notices };
}

test("settings automatically load models while preserving and persisting the user's choice", async () => {
  const requests = [];
  const ui = setup(async (request) => {
    requests.push(request);
    return apiResponse({ data: [{ id: "b-model" }, { id: "a-model" }] });
  }, { apiKey: "test-key", model: "custom-model", apiUrl: "https://example.com/proxy/v1/responses" });
  ui.tab.display();
  await flush();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/proxy/v1/models");
  assert.equal(requests[0].headers.Authorization, "Bearer test-key");
  assert.deepEqual(ui.models(), ["a-model", "b-model"]);
  assert.equal(ui.plugin.settings.model, "custom-model");
  assert.equal(ui.plugin.saves.length, 0);

  await ui.control("Available models", "dropdown").change("b-model");
  assert.equal(ui.plugin.settings.model, "b-model");
  assert.equal(ui.control("Model（", "text").value, "b-model");
  assert.equal(ui.plugin.saves.at(-1).model, "b-model");
  await ui.control("Model（", "text").change("manual-model");
  assert.equal(ui.plugin.settings.model, "manual-model");
  assert.equal(ui.control("Available models", "dropdown").value, "");
  assert.equal(ui.plugin.saves.at(-1).model, "manual-model");
  ui.tab.hide();
});

test("initial settings make no request without credentials; edits debounce and use the latest values", async () => {
  const requests = [];
  const ui = setup(async (request) => {
    requests.push(request);
    return apiResponse({ data: [{ id: "new-model" }] });
  }, { apiKey: "" });
  ui.tab.display();
  await flush();
  assert.equal(requests.length, 0);
  await ui.control("API URL", "text").change("https://new.example.com/v1");
  await ui.control("API key", "text").change("key-1");
  await ui.control("API key", "text").change("key-2");
  assert.equal(requests.length, 0);
  assert.equal(ui.clock.size, 1);
  ui.clock.runPending();
  await flush();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://new.example.com/v1/models");
  assert.equal(requests[0].headers.Authorization, "Bearer key-2");
  assert.deepEqual(ui.models(), ["new-model"]);
  ui.tab.hide();
});

test("an old provider response cannot populate the list while edited credentials are debouncing", async () => {
  const old = deferred();
  const latest = deferred();
  let requests = 0;
  const ui = setup(() => ++requests === 1 ? old.promise : latest.promise);
  ui.tab.display();
  await ui.control("API URL", "text").change("https://new.example.com/v1");
  old.resolve(apiResponse({ data: [{ id: "old-model" }] }));
  await flush();
  assert.deepEqual(ui.models(), []);
  assert.match(ui.setting("Available models").desc, /Waiting/);
  ui.clock.runPending();
  latest.resolve(apiResponse({ data: [{ id: "new-model" }] }));
  await flush();
  assert.deepEqual(ui.models(), ["new-model"]);
  assert.equal(ui.control("Available models", "button").disabled, false);
  ui.tab.hide();
});

test("a stale failure cannot overwrite a newer successful model list", async () => {
  const old = deferred();
  let requests = 0;
  const ui = setup(() => ++requests === 1 ? old.promise : Promise.resolve(apiResponse({ data: [{ id: "new-model" }] })));
  ui.tab.display();
  await ui.control("API key", "text").change("new-key");
  ui.clock.runPending();
  await flush();
  assert.deepEqual(ui.models(), ["new-model"]);
  old.reject(new Error("old provider is offline"));
  await flush();
  assert.deepEqual(ui.models(), ["new-model"]);
  assert.match(ui.setting("Available models").desc, /1 models loaded/);
  ui.tab.hide();
});

test("hiding settings cancels delayed fetches and reopening ignores previous in-flight results", async () => {
  const old = deferred();
  let requests = 0;
  const ui = setup(() => ++requests === 1 ? old.promise : Promise.resolve(apiResponse({ data: [{ id: "fresh-model" }] })));
  ui.tab.display();
  await ui.control("API key", "text").change("new-key");
  assert.equal(ui.clock.size, 1);
  ui.tab.hide();
  ui.clock.runPending();
  assert.equal(requests, 1);
  ui.tab.display();
  await flush();
  old.resolve(apiResponse({ data: [{ id: "old-model" }] }));
  await flush();
  assert.deepEqual(ui.models(), ["fresh-model"]);
  assert.equal(requests, 2);
  ui.tab.hide();
});

test("discovery failures allow manual models and recover on refresh without duplicate fetches", async () => {
  let requests = 0;
  const ui = setup(async () => ++requests === 1
    ? apiResponse({ error: { message: "Models are not supported" } }, 404)
    : apiResponse({ data: [{ id: "recovered-model" }] }));
  ui.tab.display();
  await flush();
  assert.match(ui.setting("Available models").desc, /HTTP 404.*Models are not supported.*manually/);
  assert.equal(ui.control("Available models", "dropdown").selectEl.disabled, true);
  await ui.control("Model（", "text").change("manual-model");
  assert.equal(ui.plugin.settings.model, "manual-model");
  await ui.control("API key", "text").change("updated-key");
  await ui.control("Available models", "button").click();
  ui.clock.runPending();
  await flush();
  assert.equal(requests, 2);
  assert.deepEqual(ui.models(), ["recovered-model"]);
  assert.equal(ui.plugin.settings.model, "manual-model");
  ui.tab.hide();
});

test("empty model lists and removed credentials leave manual selection intact", async () => {
  let requests = 0;
  const ui = setup(async () => { requests++; return apiResponse({ data: [] }); });
  ui.tab.display();
  await flush();
  assert.match(ui.setting("Available models").desc, /No models returned/);
  assert.equal(ui.plugin.settings.model, "gpt-4o-mini");
  await ui.control("API key", "text").change("");
  ui.clock.runPending();
  await flush();
  assert.equal(requests, 1);
  assert.match(ui.setting("Available models").desc, /Enter an API URL and key/);
  ui.tab.hide();
});

test("protocol and temperature controls persist and the Test action uses a stable snapshot", async () => {
  const pending = deferred();
  const requests = [];
  const ui = setup(async (request) => {
    requests.push(request);
    return request.method === "GET" ? apiResponse({ data: [] }) : pending.promise;
  });
  ui.tab.display();
  await flush();
  await ui.control("API type", "dropdown").change("responses");
  await ui.control("Custom temperature", "toggle").change(false);
  await ui.control("Model（", "text").change("test-model");
  assert.equal(ui.plugin.saves.at(-1).apiType, "responses");
  assert.equal(ui.plugin.saves.at(-1).sendTemperature, false);
  assert.equal(ui.control("Temperature", "slider").disabled, true);
  const testing = ui.control("Test model", "button").click();
  await flush();
  assert.equal(ui.control("Test model", "button").disabled, true);
  await ui.control("Model（", "text").change("different-model");
  pending.resolve(apiResponse(completedResponse("OK")));
  await testing;
  const request = requests.find((request) => request.method === "POST");
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  const body = JSON.parse(request.body);
  assert.equal(body.model, "test-model");
  assert.equal(body.instructions, "Reply with exactly: OK");
  assert.equal("temperature" in body, false);
  assert.match(ui.notices[0], /Model \(test-model\) responded: OK/);
  assert.equal(ui.control("Test model", "button").disabled, false);
  ui.tab.hide();
});

test("legacy saved settings receive new defaults without overwriting their connection or model", async () => {
  const old = { apiUrl: "https://custom.example.com", apiKey: "old-key", model: "old-model", temperature: 0.7 };
  const { default: Plugin } = loadModule("src/main.ts", {
    ...settingsApi(async () => { throw new Error("No requests expected during migration"); }),
    Plugin: class { async loadData() { return old; } },
  });
  const plugin = new Plugin();
  await plugin.loadSettings();
  assert.equal(plugin.settings.apiType, "chat-completions");
  assert.equal(plugin.settings.sendTemperature, true);
  for (const [key, value] of Object.entries(old)) assert.equal(plugin.settings[key], value);
});
