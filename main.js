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

// src/translator.ts
var import_obsidian = require("obsidian");
async function translate(text, settings) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  if (!settings.apiKey) {
    throw new Error("API Key is not configured. Please set it in plugin settings.");
  }
  const url = `${settings.apiUrl.replace(/\/+$/, "")}/v1/chat/completions`;
  let response;
  try {
    response = await (0, import_obsidian.requestUrl)({
      url,
      method: "POST",
      throw: false,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        messages: [
          { role: "system", content: settings.systemPrompt },
          { role: "user", content: text }
        ]
      })
    });
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (response.status !== 200) {
    const apiMsg = (_b = (_a = response.json) == null ? void 0 : _a.error) == null ? void 0 : _b.message;
    const code = (_h = (_g = (_d = (_c = response.json) == null ? void 0 : _c.error) == null ? void 0 : _d.code) != null ? _g : (_f = (_e = response.json) == null ? void 0 : _e.error) == null ? void 0 : _f.type) != null ? _h : "";
    const detail = [apiMsg, code].filter(Boolean).join(" \u2014 ");
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const content = (_l = (_k = (_j = (_i = response.json) == null ? void 0 : _i.choices) == null ? void 0 : _j[0]) == null ? void 0 : _k.message) == null ? void 0 : _l.content;
  if (typeof content !== "string") {
    throw new Error("Unexpected API response format: no content in response.");
  }
  return content.trim();
}
async function testModel(settings) {
  return translate("Hello", { ...settings, systemPrompt: "Reply with exactly: OK" });
}

// src/settings.ts
var DEFAULT_SETTINGS = {
  apiUrl: "https://api.openai.com",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.3,
  systemPrompt: "You are a translator. Detect the language of the input text. If it is Chinese, translate it to English. Otherwise, translate it to Chinese. Output ONLY the translated text, no explanations.",
  autoTranslate: false,
  autoTranslateDelay: 500
};
var TranslateSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
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
    new import_obsidian2.Setting(containerEl).setName("API URL").setDesc("OpenAI-compatible API base URL").addText(
      (text) => text.setPlaceholder("https://api.openai.com").setValue(this.plugin.settings.apiUrl).onChange(async (value) => {
        this.plugin.settings.apiUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("API Key").setDesc("Your API key").addText((text) => {
      text.setPlaceholder("sk-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
    });
    new import_obsidian2.Setting(containerEl).setName("Model").setDesc("Model name to use for translation").addText(
      (text) => text.setPlaceholder("gpt-4o-mini").setValue(this.plugin.settings.model).onChange(async (value) => {
        this.plugin.settings.model = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Test model").setDesc(`Send a test request using the current API URL, Key, and Model`).addButton(
      (btn) => btn.setButtonText("Test").onClick(async () => {
        btn.setDisabled(true);
        btn.setButtonText("Testing...");
        try {
          const reply = await testModel(this.plugin.settings);
          new import_obsidian2.Notice(`Model (${this.plugin.settings.model}) responded: ${reply}`, 6e3);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          new import_obsidian2.Notice(`Test failed: ${msg}`, 6e3);
        } finally {
          btn.setDisabled(false);
          btn.setButtonText("Test");
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Temperature").setDesc("Controls randomness (0 = deterministic, 2 = creative)").addSlider(
      (slider) => slider.setLimits(0, 2, 0.1).setValue(this.plugin.settings.temperature).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.temperature = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("System Prompt").setDesc("System prompt sent to the LLM for translation").addTextArea((text) => {
      text.setPlaceholder("You are a translator...").setValue(this.plugin.settings.systemPrompt).onChange(async (value) => {
        this.plugin.settings.systemPrompt = value;
        await this.plugin.saveSettings();
      });
      text.inputEl.rows = 5;
      text.inputEl.cols = 40;
    });
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
    this.actionsEl.style.display = "none";
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
      handle.style.cursor = "grab";
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
      handle.style.cursor = "grabbing";
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
    this.actionsEl.style.display = "";
    const copyBtn = this.actionsEl.createEl("button", {
      text: "Copy",
      cls: "llm-translate-btn"
    });
    copyBtn.addEventListener("click", () => this.copyResult());
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
    this.ribbonEl = this.addRibbonIcon("languages", "Toggle auto-translate", () => this.toggleAutoTranslate());
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
          this.translateWithEditor(view.editor);
        } else {
          this.translateFromDOM();
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
    if (!this.ribbonEl) return;
    this.ribbonEl.toggleClass("is-active", this.settings.autoTranslate);
  }
  /** Hotkey handler: detect current mode and dispatch accordingly */
  handleTranslateCommand() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    if (!view) {
      new import_obsidian4.Notice("No active markdown view");
      return;
    }
    if (view.getMode() === "source") {
      this.translateWithEditor(view.editor);
    } else {
      this.translateFromDOM();
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
        this.popover.setResult(result);
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
