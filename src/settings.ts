import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TranslatePlugin from "./main";
import { testModel } from "./translator";

export interface TranslatePluginSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  autoTranslate: boolean;
  autoTranslateDelay: number;
}

export const DEFAULT_SETTINGS: TranslatePluginSettings = {
  apiUrl: "https://api.openai.com",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.3,
  systemPrompt:
    "You are a translator. Detect the language of the input text. If it is Chinese, translate it to English. Otherwise, translate it to Chinese. Output ONLY the translated text, no explanations.",
  autoTranslate: false,
  autoTranslateDelay: 500,
};

export class TranslateSettingTab extends PluginSettingTab {
  plugin: TranslatePlugin;

  constructor(app: App, plugin: TranslatePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Auto-translate on selection")
      .setDesc("Automatically translate when you finish selecting text (mouse release)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoTranslate)
          .onChange(async (value) => {
            this.plugin.settings.autoTranslate = value;
            await this.plugin.saveSettings();
            this.plugin.updateRibbonIcon();
          })
      );

    new Setting(containerEl)
      .setName("Auto-translate delay (ms)")
      .setDesc("Wait time between releasing the mouse and triggering translation")
      .addSlider((slider) =>
        slider
          .setLimits(0, 2000, 50)
          .setValue(this.plugin.settings.autoTranslateDelay)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.autoTranslateDelay = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API URL")
      .setDesc("OpenAI-compatible API base URL")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your API key")
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Model name to use for translation")
      .addText((text) =>
        text
          .setPlaceholder("gpt-4o-mini")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Test model")
      .setDesc(`Send a test request using the current API URL, Key, and Model`)
      .addButton((btn) =>
        btn.setButtonText("Test").onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText("Testing...");
          try {
            const reply = await testModel(this.plugin.settings);
            new Notice(`Model (${this.plugin.settings.model}) responded: ${reply}`, 6000);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            new Notice(`Test failed: ${msg}`, 6000);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText("Test");
          }
        })
      );

    new Setting(containerEl)
      .setName("Temperature")
      .setDesc("Controls randomness (0 = deterministic, 2 = creative)")
      .addSlider((slider) =>
        slider
          .setLimits(0, 2, 0.1)
          .setValue(this.plugin.settings.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.temperature = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("System Prompt")
      .setDesc("System prompt sent to the LLM for translation")
      .addTextArea((text) => {
        text
          .setPlaceholder("You are a translator...")
          .setValue(this.plugin.settings.systemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.systemPrompt = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
        text.inputEl.cols = 40;
      });
  }
}
