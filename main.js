var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TranslatePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var import_obsidian2 = require("obsidian");

// src/api.ts
var import_obsidian = require("obsidian");
function asRecord(value) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }
  return void 0;
}
function buildApiUrl(apiUrl, endpoint) {
  let url;
  try {
    url = new URL(apiUrl.trim());
  } catch (e) {
    throw new Error("Invalid API URL\uFF08\u63A5\u53E3\u5730\u5740\u65E0\u6548\uFF09. Enter an HTTP or HTTPS URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid API URL\uFF08\u63A5\u53E3\u5730\u5740\u65E0\u6548\uFF09. Use HTTP or HTTPS.");
  }
  let path = url.pathname.replace(/\/+$/, "");
  const suffix = path.match(/\/(chat\/completions|responses?|models)$/);
  if (suffix) {
    path = path.slice(0, -suffix[0].length);
  } else if (!/\/v\d+(?:beta\d*)?$/.test(path)) {
    path += "/v1";
  }
  const route = endpoint === "responses" && (suffix == null ? void 0 : suffix[1]) === "response" ? "response" : endpoint;
  url.pathname = `${path}/${route}`;
  url.hash = "";
  return url.toString();
}
function errorDetail(value) {
  var _a;
  if (typeof value === "string")
    return value.slice(0, 500);
  const error = asRecord(value);
  if (!error)
    return "";
  return [error.message, (_a = error.code) != null ? _a : error.type].filter((part) => typeof part === "string" && part.length > 0).join(" \u2014 ").slice(0, 500);
}
async function requestApi(settings, endpoint, body) {
  var _a;
  if (!settings.apiKey.trim()) {
    throw new Error("API key is not configured\uFF08\u672A\u914D\u7F6E API \u5BC6\u94A5\uFF09. Please set it in plugin settings.");
  }
  const url = buildApiUrl(settings.apiUrl, endpoint);
  let response;
  try {
    response = await (0, import_obsidian.requestUrl)({
      url,
      method: body ? "POST" : "GET",
      throw: false,
      headers: {
        ...body ? { "Content-Type": "application/json" } : {},
        Authorization: `Bearer ${settings.apiKey.trim()}`
      },
      ...body ? { body: JSON.stringify(body) } : {}
    });
  } catch (err) {
    throw new Error(`Network error\uFF08\u7F51\u7EDC\u9519\u8BEF\uFF09: ${err instanceof Error ? err.message : String(err)}`);
  }
  let data;
  try {
    data = JSON.parse(response.text);
  } catch (e) {
    throw new Error(`HTTP ${response.status}: upstream returned a non-JSON response\uFF08\u4E0A\u6E38\u8FD4\u56DE\u4E86\u975E JSON \u54CD\u5E94\uFF09.`);
  }
  const error = (_a = asRecord(data)) == null ? void 0 : _a.error;
  const detail = errorDetail(error);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  if (error) {
    throw new Error(`API error\uFF08\u63A5\u53E3\u9519\u8BEF\uFF09${detail ? `: ${detail}` : ""}`);
  }
  return data;
}
async function fetchModels(settings) {
  var _a, _b;
  const data = (_a = asRecord(await requestApi(settings, "models"))) == null ? void 0 : _a.data;
  if (!Array.isArray(data)) {
    throw new Error("Unexpected model list format\uFF08\u6A21\u578B\u5217\u8868\u683C\u5F0F\u5F02\u5E38\uFF09: expected a data array.");
  }
  const ids = [];
  for (const item of data) {
    const id = (_b = asRecord(item)) == null ? void 0 : _b.id;
    if (typeof id === "string" && id.trim())
      ids.push(id.trim());
  }
  if (data.length > 0 && ids.length === 0) {
    throw new Error("No valid model IDs in response\uFF08\u54CD\u5E94\u4E2D\u6CA1\u6709\u6709\u6548\u7684\u6A21\u578B\u540D\u79F0\uFF09.");
  }
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

// src/translator.ts
function responseText(data) {
  var _a, _b;
  const response = asRecord(data);
  if (!response)
    throw new Error("Unexpected Responses format\uFF08\u54CD\u5E94\u683C\u5F0F\u5F02\u5E38\uFF09.");
  if (response.status && response.status !== "completed") {
    const reason = (_a = asRecord(response.incomplete_details)) == null ? void 0 : _a.reason;
    throw new Error(`Response not completed\uFF08\u54CD\u5E94\u672A\u5B8C\u6210\uFF09: ${response.status}${typeof reason === "string" ? ` \u2014 ${reason}` : ""}`);
  }
  const parts = [];
  if (Array.isArray(response.output)) {
    for (const value of response.output) {
      const item = asRecord(value);
      if ((item == null ? void 0 : item.type) !== "message" || item.role !== "assistant" || !Array.isArray(item.content))
        continue;
      if (item.status && item.status !== "completed") {
        throw new Error(`Response message not completed\uFF08\u54CD\u5E94\u6D88\u606F\u672A\u5B8C\u6210\uFF09: ${item.status}`);
      }
      for (const value2 of item.content) {
        const part = asRecord(value2);
        if ((part == null ? void 0 : part.type) === "refusal") {
          throw new Error(`Model refused the request\uFF08\u6A21\u578B\u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF09: ${(_b = part.refusal) != null ? _b : ""}`);
        }
        if ((part == null ? void 0 : part.type) === "output_text" && typeof part.text === "string") {
          parts.push(part.text);
        }
      }
    }
  }
  return parts.length > 0 ? parts.join("") : typeof response.output_text === "string" ? response.output_text : "";
}
function chatText(data) {
  var _a;
  const choices = (_a = asRecord(data)) == null ? void 0 : _a.choices;
  const choice = Array.isArray(choices) ? asRecord(choices[0]) : void 0;
  const message = asRecord(choice == null ? void 0 : choice.message);
  if (message == null ? void 0 : message.refusal) {
    throw new Error(`Model refused the request\uFF08\u6A21\u578B\u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF09: ${message.refusal}`);
  }
  if ((choice == null ? void 0 : choice.finish_reason) === "length" || (choice == null ? void 0 : choice.finish_reason) === "content_filter") {
    throw new Error(`Translation not completed\uFF08\u7FFB\u8BD1\u672A\u5B8C\u6210\uFF09: ${choice.finish_reason}`);
  }
  return typeof (message == null ? void 0 : message.content) === "string" ? message.content : "";
}
async function translate(text, settings) {
  if (!settings.model.trim()) {
    throw new Error("Model is not configured\uFF08\u672A\u914D\u7F6E\u6A21\u578B\uFF09. Please choose or enter a model.");
  }
  const useResponses = settings.apiType === "responses";
  const body = {
    model: settings.model.trim(),
    ...settings.sendTemperature !== false ? { temperature: settings.temperature } : {},
    ...useResponses ? {
      instructions: settings.systemPrompt,
      input: [{ role: "user", content: [{ type: "input_text", text }] }],
      store: false,
      stream: false
    } : {
      messages: [
        { role: "system", content: settings.systemPrompt },
        { role: "user", content: text }
      ]
    }
  };
  const data = await requestApi(settings, useResponses ? "responses" : "chat/completions", body);
  const content = (useResponses ? responseText(data) : chatText(data)).trim();
  if (!content) {
    throw new Error("Unexpected API response format\uFF08\u63A5\u53E3\u54CD\u5E94\u683C\u5F0F\u5F02\u5E38\uFF09: no translated text in response.");
  }
  return content;
}
async function testModel(settings) {
  return translate("Hello", { ...settings, systemPrompt: "Reply with exactly: OK" });
}

// src/settings.ts
var DEFAULT_SETTINGS = {
  apiUrl: "https://api.openai.com",
  apiKey: "",
  apiType: "chat-completions",
  model: "gpt-4o-mini",
  temperature: 0.3,
  sendTemperature: true,
  systemPrompt: "You are a translator. Detect the language of the input text. If it is Chinese, translate it to English. Otherwise, translate it to Chinese. Output ONLY the translated text, no explanations.",
  autoTranslate: false,
  autoTranslateDelay: 500
};
var TranslateSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.models = [];
    this.modelRequestId = 0;
    this.visible = false;
    this.plugin = plugin;
  }
  display() {
    this.hide();
    this.visible = true;
    this.models = [];
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Auto-translate on selection").setDesc("Automatically translate when you finish selecting text (mouse release)").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoTranslate).onChange(async (value) => {
        this.plugin.settings.autoTranslate = value;
        await this.plugin.saveSettings();
        this.plugin.updateRibbonIcon();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Auto-translate delay (ms)").setDesc("Wait time between releasing the mouse and triggering translation").addSlider(
      (slider) => slider.setLimits(0, 2e3, 50).setValue(this.plugin.settings.autoTranslateDelay).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.autoTranslateDelay = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("API type\uFF08\u63A5\u53E3\u7C7B\u578B\uFF09").setDesc("Choose the interface supported by your provider\uFF08\u9009\u62E9\u4E0A\u6E38\u652F\u6301\u7684\u63A5\u53E3\uFF09").addDropdown(
      (dropdown) => dropdown.addOption("chat-completions", "Chat Completions\uFF08\u804A\u5929\u8865\u5168\uFF09").addOption("responses", "Responses\uFF08\u54CD\u5E94\uFF09").setValue(this.plugin.settings.apiType).onChange(async (value) => {
        if (value !== "chat-completions" && value !== "responses")
          return;
        this.plugin.settings.apiType = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("API URL").setDesc("Host, base URL ending in /v1, or full endpoint\uFF08\u652F\u6301\u57DF\u540D\u3001\u4EE5 /v1 \u7ED3\u5C3E\u7684\u57FA\u7840\u5730\u5740\u6216\u5B8C\u6574\u63A5\u53E3\u5730\u5740\uFF09").addText(
      (text) => text.setPlaceholder("https://api.openai.com").setValue(this.plugin.settings.apiUrl).onChange(async (value) => {
        this.plugin.settings.apiUrl = value.trim();
        this.scheduleModelRefresh();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("API key").setDesc("Your API key").addText((text) => {
      text.setPlaceholder("sk-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        this.scheduleModelRefresh();
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
    });
    new import_obsidian2.Setting(containerEl).setName("Model\uFF08\u6A21\u578B\uFF09").setDesc("Choose from the list below or enter a model name\uFF08\u53EF\u4ECE\u4E0B\u65B9\u5217\u8868\u9009\u62E9\uFF0C\u4E5F\u53EF\u624B\u52A8\u8F93\u5165\uFF09").addText((text) => {
      this.modelText = text;
      text.setPlaceholder("gpt-4o-mini").setValue(this.plugin.settings.model).onChange(async (value) => {
        this.plugin.settings.model = value.trim();
        this.updateModelDropdown();
        await this.plugin.saveSettings();
      });
    });
    this.modelListSetting = new import_obsidian2.Setting(containerEl).setName("Available models\uFF08\u53EF\u7528\u6A21\u578B\uFF09").addDropdown((dropdown) => {
      this.modelDropdown = dropdown;
      dropdown.onChange(async (value) => {
        var _a;
        if (!value)
          return;
        this.plugin.settings.model = value;
        (_a = this.modelText) == null ? void 0 : _a.setValue(value);
        await this.plugin.saveSettings();
      });
    }).addButton((button) => {
      this.refreshButton = button;
      button.setButtonText("Refresh\uFF08\u5237\u65B0\uFF09").onClick(() => {
        void this.refreshModels();
      });
    });
    this.updateModelDropdown();
    new import_obsidian2.Setting(containerEl).setName("Test model").setDesc("Send a test request using the current API URL, key, and model").addButton(
      (btn) => btn.setButtonText("Test").onClick(async () => {
        btn.setDisabled(true);
        btn.setButtonText("Testing...");
        try {
          const settings = { ...this.plugin.settings };
          const reply = await testModel(settings);
          new import_obsidian2.Notice(`Model (${settings.model}) responded: ${reply}`, 6e3);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          new import_obsidian2.Notice(`Test failed: ${msg}`, 6e3);
        } finally {
          btn.setDisabled(false);
          btn.setButtonText("Test");
        }
      })
    );
    const temperatureSetting = new import_obsidian2.Setting(containerEl).setName("Custom temperature\uFF08\u81EA\u5B9A\u4E49\u6E29\u5EA6\uFF09").setDesc("Turn off if the model rejects temperature\uFF08\u6A21\u578B\u4E0D\u652F\u6301\u6E29\u5EA6\u53C2\u6570\u65F6\u5173\u95ED\uFF0C\u4F7F\u7528\u4E0A\u6E38\u9ED8\u8BA4\u503C\uFF09");
    const temperatureSliderSetting = new import_obsidian2.Setting(containerEl).setName("Temperature").setDesc("Controls randomness (0 = deterministic, 2 = creative)").addSlider(
      (slider) => slider.setLimits(0, 2, 0.1).setValue(this.plugin.settings.temperature).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.temperature = value;
        await this.plugin.saveSettings();
      })
    );
    temperatureSliderSetting.setDisabled(!this.plugin.settings.sendTemperature);
    temperatureSetting.addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.sendTemperature).onChange(async (value) => {
        this.plugin.settings.sendTemperature = value;
        temperatureSliderSetting.setDisabled(!value);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("System prompt").setDesc("System prompt sent to the LLM for translation").addTextArea((text) => {
      text.setPlaceholder("You are a translator...").setValue(this.plugin.settings.systemPrompt).onChange(async (value) => {
        this.plugin.settings.systemPrompt = value;
        await this.plugin.saveSettings();
      });
      text.inputEl.rows = 5;
      text.inputEl.cols = 40;
    });
    void this.refreshModels();
  }
  hide() {
    this.visible = false;
    this.modelRequestId++;
    this.clearModelRefreshTimer();
  }
  clearModelRefreshTimer() {
    if (this.modelRefreshTimer !== void 0) {
      clearTimeout(this.modelRefreshTimer);
      this.modelRefreshTimer = void 0;
    }
  }
  updateModelDropdown() {
    const dropdown = this.modelDropdown;
    if (!dropdown)
      return;
    dropdown.selectEl.empty();
    dropdown.addOption("", "Choose a model\uFF08\u9009\u62E9\u6A21\u578B\uFF09");
    for (const model of this.models)
      dropdown.addOption(model, model);
    dropdown.setValue(this.models.includes(this.plugin.settings.model) ? this.plugin.settings.model : "");
    dropdown.selectEl.disabled = this.models.length === 0;
  }
  scheduleModelRefresh() {
    var _a, _b;
    this.clearModelRefreshTimer();
    this.modelRequestId++;
    this.models = [];
    this.updateModelDropdown();
    (_a = this.refreshButton) == null ? void 0 : _a.setDisabled(false);
    (_b = this.modelListSetting) == null ? void 0 : _b.setDesc("Waiting for API settings\uFF08\u7B49\u5F85\u63A5\u53E3\u914D\u7F6E\uFF09\u2026");
    this.modelRefreshTimer = setTimeout(() => {
      this.modelRefreshTimer = void 0;
      void this.refreshModels();
    }, 600);
  }
  async refreshModels() {
    var _a, _b, _c, _d, _e, _f, _g;
    this.clearModelRefreshTimer();
    if (!this.visible)
      return;
    const requestId = ++this.modelRequestId;
    const settings = { ...this.plugin.settings };
    this.models = [];
    this.updateModelDropdown();
    if (!settings.apiUrl || !settings.apiKey) {
      (_a = this.refreshButton) == null ? void 0 : _a.setDisabled(false);
      (_b = this.modelListSetting) == null ? void 0 : _b.setDesc("Enter an API URL and key to load models automatically\uFF08\u586B\u5199\u5730\u5740\u4E0E\u5BC6\u94A5\u540E\u81EA\u52A8\u83B7\u53D6\u6A21\u578B\uFF09.");
      return;
    }
    (_c = this.refreshButton) == null ? void 0 : _c.setDisabled(true);
    (_d = this.modelListSetting) == null ? void 0 : _d.setDesc("Loading models\uFF08\u6B63\u5728\u83B7\u53D6\u6A21\u578B\uFF09\u2026");
    try {
      const models = await fetchModels(settings);
      if (!this.visible || requestId !== this.modelRequestId)
        return;
      this.models = models;
      this.updateModelDropdown();
      (_e = this.modelListSetting) == null ? void 0 : _e.setDesc(models.length > 0 ? `${models.length} models loaded\uFF08\u5DF2\u83B7\u53D6 ${models.length} \u4E2A\u6A21\u578B\uFF09. Choose one, then test it\uFF08\u9009\u62E9\u540E\u53EF\u70B9\u51FB Test \u6D4B\u8BD5\uFF09.` : "No models returned. Enter a model manually\uFF08\u4E0A\u6E38\u672A\u8FD4\u56DE\u6A21\u578B\uFF0C\u53EF\u624B\u52A8\u8F93\u5165\uFF09.");
    } catch (err) {
      if (!this.visible || requestId !== this.modelRequestId)
        return;
      const message = err instanceof Error ? err.message : String(err);
      (_f = this.modelListSetting) == null ? void 0 : _f.setDesc(`Could not load models\uFF08\u83B7\u53D6\u6A21\u578B\u5931\u8D25\uFF09: ${message}. Enter a model manually\uFF08\u53EF\u624B\u52A8\u8F93\u5165\u6A21\u578B\uFF09.`);
    } finally {
      if (this.visible && requestId === this.modelRequestId) {
        (_g = this.refreshButton) == null ? void 0 : _g.setDisabled(false);
      }
    }
  }
};

// src/popover.ts
var import_obsidian3 = require("obsidian");
var TranslatePopover = class {
  constructor(rect, component, onReplace) {
    this.result = null;
    this.onReplace = null;
    this._interacting = false;
    this.onReplace = onReplace != null ? onReplace : null;
    this.component = component;
    this.containerEl = document.createElement("div");
    this.containerEl.addClass("llm-translate-popover");
    const headerEl = this.containerEl.createDiv("llm-translate-header");
    headerEl.createSpan({ text: "Translation", cls: "llm-translate-title" });
    const closeBtn = headerEl.createEl("button", {
      text: "\xD7",
      cls: "llm-translate-close"
    });
    closeBtn.addEventListener("click", () => this.close());
    this.contentEl = this.containerEl.createDiv("llm-translate-content");
    this.contentEl.createDiv({ cls: "llm-translate-loading", text: "Translating..." });
    this.actionsEl = this.containerEl.createDiv("llm-translate-actions");
    this.actionsEl.addClass("llm-translate-hidden");
    const resizeHandle = this.containerEl.createDiv("llm-translate-resize-handle");
    this.setupResize(resizeHandle);
    this.setInitialSize();
    this.positionAt(rect);
    document.body.appendChild(this.containerEl);
    this.setupDrag(headerEl);
    this.escHandler = (e) => {
      if (e.key === "Escape")
        this.close();
    };
    this.clickOutsideHandler = (e) => {
      if (!this.containerEl.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener("keydown", this.escHandler);
    setTimeout(() => {
      document.addEventListener("mousedown", this.clickOutsideHandler);
    }, 100);
  }
  /** Set initial width to half the article pane width */
  setInitialSize() {
    var _a, _b;
    const articleEl = (_a = document.querySelector(".markdown-source-view .cm-content")) != null ? _a : document.querySelector(".markdown-preview-view");
    const articleWidth = (_b = articleEl == null ? void 0 : articleEl.offsetWidth) != null ? _b : 0;
    const initialWidth = articleWidth > 200 ? Math.round(articleWidth / 2) : 400;
    this.containerEl.style.width = `${initialWidth}px`;
  }
  positionAt(rect) {
    const margin = 8;
    const popoverWidth = this.containerEl.offsetWidth || 400;
    const popoverHeight = 200;
    let top = rect.bottom + margin;
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth) {
      left = window.innerWidth - popoverWidth - margin;
    }
    if (left < margin)
      left = margin;
    if (top + popoverHeight > window.innerHeight) {
      top = rect.top - popoverHeight - margin;
    }
    if (top < margin)
      top = margin;
    this.containerEl.style.top = `${top}px`;
    this.containerEl.style.left = `${left}px`;
  }
  /** Make the popover draggable by its header */
  setupDrag(handle) {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.containerEl.style.left = `${startLeft + dx}px`;
      this.containerEl.style.top = `${startTop + dy}px`;
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      handle.removeClass("is-dragging");
      this._interacting = false;
    };
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".llm-translate-close"))
        return;
      e.preventDefault();
      this._interacting = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(this.containerEl.style.left) || 0;
      startTop = parseInt(this.containerEl.style.top) || 0;
      handle.addClass("is-dragging");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
  /** Make the popover resizable via a bottom-right handle */
  setupResize(handle) {
    let startX = 0, startWidth = 0;
    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const newWidth = Math.max(200, startWidth + dx);
      this.containerEl.style.width = `${newWidth}px`;
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      this._interacting = false;
    };
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._interacting = true;
      startX = e.clientX;
      startWidth = this.containerEl.offsetWidth;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
  async setResult(text) {
    this.result = text;
    this.contentEl.empty();
    const resultEl = this.contentEl.createDiv({ cls: "llm-translate-result" });
    await import_obsidian3.MarkdownRenderer.render(
      this.component.app,
      text,
      resultEl,
      "",
      this.component
    );
    this.actionsEl.removeClass("llm-translate-hidden");
    const copyBtn = this.actionsEl.createEl("button", {
      text: "Copy",
      cls: "llm-translate-btn"
    });
    copyBtn.addEventListener("click", () => {
      void this.copyResult();
    });
    if (this.onReplace) {
      const replaceBtn = this.actionsEl.createEl("button", {
        text: "Replace",
        cls: "llm-translate-btn"
      });
      replaceBtn.addEventListener("click", () => this.replaceSelection());
    }
  }
  setError(message) {
    this.contentEl.empty();
    this.contentEl.createDiv({ text: message, cls: "llm-translate-error" });
  }
  async copyResult() {
    if (this.result) {
      await navigator.clipboard.writeText(this.result);
    }
  }
  replaceSelection() {
    if (this.result && this.onReplace) {
      this.onReplace(this.result);
      this.close();
    }
  }
  close() {
    document.removeEventListener("keydown", this.escHandler);
    document.removeEventListener("mousedown", this.clickOutsideHandler);
    this.containerEl.remove();
  }
  isOpen() {
    return this.containerEl.isConnected;
  }
  containsTarget(el) {
    return this.containerEl.contains(el);
  }
  isInteracting() {
    return this._interacting;
  }
};

// src/main.ts
var TranslatePlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.popover = null;
    this._translateSeq = 0;
    this.ribbonEl = null;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TranslateSettingTab(this.app, this));
    this.ribbonEl = this.addRibbonIcon(
      "languages",
      "Toggle auto-translate",
      () => this.toggleAutoTranslate()
    );
    this.updateRibbonIcon();
    this.addCommand({
      id: "translate-selection",
      name: "Translate selection",
      callback: () => this.handleTranslateCommand()
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const selection = editor.getSelection();
        if (selection) {
          menu.addItem((item) => {
            item.setTitle("Translate selection").setIcon("languages").onClick(() => this.translateWithEditor(editor));
          });
        }
      })
    );
    this.registerDomEvent(document, "mouseup", (evt) => {
      var _a;
      if (!this.settings.autoTranslate)
        return;
      if (((_a = this.popover) == null ? void 0 : _a.isOpen()) && (this.popover.containsTarget(evt.target) || this.popover.isInteracting()))
        return;
      const target = evt.target;
      const inMarkdown = target.closest(".markdown-source-view") || target.closest(".markdown-preview-view");
      if (!inMarkdown)
        return;
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel == null ? void 0 : sel.toString().trim();
        if (!text || !sel || sel.rangeCount === 0)
          return;
        const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
        if ((view == null ? void 0 : view.getMode()) === "source") {
          void this.translateWithEditor(view.editor);
        } else {
          void this.translateFromDOM();
        }
      }, this.settings.autoTranslateDelay);
    });
    this.registerDomEvent(document, "contextmenu", (evt) => {
      const target = evt.target;
      if (!target.closest(".markdown-preview-view"))
        return;
      const sel = window.getSelection();
      const text = sel == null ? void 0 : sel.toString().trim();
      if (!text)
        return;
      evt.preventDefault();
      const menu = new import_obsidian4.Menu();
      menu.addItem((item) => {
        item.setTitle("Translate selection").setIcon("languages").onClick(() => this.translateFromDOM());
      });
      menu.showAtMouseEvent(evt);
    });
  }
  onunload() {
    this.closePopover();
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  closePopover() {
    if (this.popover) {
      this.popover.close();
      this.popover = null;
    }
  }
  async toggleAutoTranslate() {
    this.settings.autoTranslate = !this.settings.autoTranslate;
    await this.saveSettings();
    this.updateRibbonIcon();
    new import_obsidian4.Notice(`Auto-translate ${this.settings.autoTranslate ? "enabled" : "disabled"}`);
  }
  updateRibbonIcon() {
    if (!this.ribbonEl)
      return;
    this.ribbonEl.toggleClass("is-active", this.settings.autoTranslate);
  }
  /** Hotkey handler: detect current mode and dispatch accordingly */
  handleTranslateCommand() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    if (!view) {
      new import_obsidian4.Notice("No active Markdown view");
      return;
    }
    if (view.getMode() === "source") {
      void this.translateWithEditor(view.editor);
    } else {
      void this.translateFromDOM();
    }
  }
  /** Translate in editor mode — supports Replace */
  async translateWithEditor(editor) {
    const text = editor.getSelection();
    if (!text) {
      new import_obsidian4.Notice("No text selected");
      return;
    }
    this.closePopover();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      new import_obsidian4.Notice("Could not determine selection position");
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    this.popover = new TranslatePopover(rect, this, (replacement) => {
      editor.replaceSelection(replacement);
    });
    await this.doTranslate(text);
  }
  /** Translate in reading mode — Copy only, no Replace */
  async translateFromDOM() {
    const sel = window.getSelection();
    const text = sel == null ? void 0 : sel.toString().trim();
    if (!text || !sel || sel.rangeCount === 0) {
      new import_obsidian4.Notice("No text selected");
      return;
    }
    this.closePopover();
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    this.popover = new TranslatePopover(rect, this);
    await this.doTranslate(text);
  }
  /** Shared translate + popover update logic */
  async doTranslate(text) {
    var _a, _b;
    const seq = ++this._translateSeq;
    try {
      const result = await translate(text, this.settings);
      if (seq !== this._translateSeq)
        return;
      if ((_a = this.popover) == null ? void 0 : _a.isOpen()) {
        void this.popover.setResult(result);
      }
    } catch (err) {
      if (seq !== this._translateSeq)
        return;
      const message = err instanceof Error ? err.message : String(err);
      if ((_b = this.popover) == null ? void 0 : _b.isOpen()) {
        this.popover.setError(message);
      } else {
        new import_obsidian4.Notice(`Translation failed: ${message}`);
      }
    }
  }
};
