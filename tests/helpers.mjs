import { buildSync } from "esbuild";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { Script } from "node:vm";

const require = createRequire(import.meta.url);

export function loadModule(entry, obsidian, globals = {}) {
  const { outputFiles } = buildSync({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    external: ["obsidian"],
  });
  const module = { exports: {} };
  new Script(outputFiles[0].text, { filename: entry }).runInNewContext({
    module,
    exports: module.exports,
    require: (id) => id === "obsidian" ? obsidian : require(id),
    URL,
    setTimeout,
    clearTimeout,
    console,
    ...globals,
  });
  return module.exports;
}

/** Mimic requestUrl's response, including its throwing JSON accessor. */
export function apiResponse(data, status = 200) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return {
    status,
    headers: {},
    text,
    arrayBuffer: new ArrayBuffer(0),
    get json() { return JSON.parse(text); },
  };
}

/** Send real HTTP requests to the test server through the Obsidian boundary. */
export async function localRequestUrl(options) {
  if (new URL(options.url).hostname !== "127.0.0.1") {
    throw new Error("Tests only allow loopback requests");
  }
  const response = await fetch(options.url, options);
  return apiResponse(await response.text(), response.status);
}

export async function withServer(handler, run) {
  const server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      await handler({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: body ? JSON.parse(body) : undefined,
      }, response);
    } catch (error) {
      response.writeHead(500);
      response.end(JSON.stringify({ error: { message: String(error) } }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

export function reply(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

export function completedResponse(text = "你好") {
  return {
    object: "response",
    status: "completed",
    error: null,
    output: [
      { type: "reasoning", summary: [{ type: "summary_text", text: "Not a translation" }] },
      { type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] },
    ],
  };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

export const flush = () => new Promise((resolve) => setImmediate(resolve));

/** A small adapter for Obsidian's public settings component API. */
export function settingsApi(requestUrl) {
  class Control {
    constructor(kind) {
      this.kind = kind;
      this.options = new Map();
      this.inputEl = {};
      this.selectEl = { empty: () => this.options.clear(), disabled: false };
    }
    setValue(value) { this.value = value; return this; }
    setPlaceholder(value) { this.placeholder = value; return this; }
    setLimits() { return this; }
    setDynamicTooltip() { return this; }
    setDisabled(value) { this.disabled = value; return this; }
    setButtonText(value) { this.buttonText = value; return this; }
    addOption(value, label) { this.options.set(value, label); return this; }
    onChange(callback) { this.changeHandler = callback; return this; }
    onClick(callback) { this.clickHandler = callback; return this; }
    async change(value) { this.value = value; await this.changeHandler(value); }
    async click() {
      if (this.disabled) throw new Error("Cannot click a disabled button");
      await this.clickHandler();
    }
  }
  class Setting {
    constructor(container) { this.controls = []; container.settings.push(this); }
    setName(value) { this.name = value; return this; }
    setDesc(value) { this.desc = value; return this; }
    setDisabled(value) { this.controls.forEach((control) => control.setDisabled(value)); return this; }
    add(kind, callback) { const control = new Control(kind); this.controls.push(control); callback(control); return this; }
    addText(callback) { return this.add("text", callback); }
    addTextArea(callback) { return this.add("textarea", callback); }
    addToggle(callback) { return this.add("toggle", callback); }
    addSlider(callback) { return this.add("slider", callback); }
    addDropdown(callback) { return this.add("dropdown", callback); }
    addButton(callback) { return this.add("button", callback); }
  }
  const notices = [];
  return {
    requestUrl,
    Setting,
    PluginSettingTab: class {
      constructor() { this.containerEl = { settings: [], empty() { this.settings = []; } }; }
    },
    Notice: class { constructor(message) { notices.push(message); } },
    notices,
  };
}

export function fakeClock() {
  const tasks = new Map();
  let nextId = 0;
  return {
    setTimeout: (callback) => { const id = ++nextId; tasks.set(id, callback); return id; },
    clearTimeout: (id) => tasks.delete(id),
    runPending() {
      const pending = [...tasks.values()];
      tasks.clear();
      pending.forEach((callback) => callback());
    },
    get size() { return tasks.size; },
  };
}
