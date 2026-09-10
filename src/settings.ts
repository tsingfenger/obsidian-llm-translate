import {
  App, Notice, PluginSettingTab, Setting,
  type ButtonComponent, type DropdownComponent, type TextComponent,
} from "obsidian";
import type TranslatePlugin from "./main";
import { testModel } from "./translator";
import { fetchModels } from "./api";

export type ApiType = "chat-completions" | "responses";

export interface TranslatePluginSettings {
  apiUrl: string;
  apiKey: string;
  apiType: ApiType;
  model: string;
  temperature: number;
  sendTemperature: boolean;
  systemPrompt: string;
  autoTranslate: boolean;
  autoTranslateDelay: number;
}

export const DEFAULT_SETTINGS: TranslatePluginSettings = {
  apiUrl: "https://api.openai.com",
  apiKey: "",
  apiType: "chat-completions",
  model: "gpt-4o-mini",
  temperature: 0.3,
  sendTemperature: true,
  systemPrompt:
    "You are a translator. Detect the language of the input text. If it is Chinese, translate it to English. Otherwise, translate it to Chinese. Output ONLY the translated text, no explanations.",
  autoTranslate: false,
  autoTranslateDelay: 500,
};

export class TranslateSettingTab extends PluginSettingTab {
  plugin: TranslatePlugin;
  private models: string[] = [];
  private modelText?: TextComponent;
  private modelDropdown?: DropdownComponent;
  private modelListSetting?: Setting;
  private refreshButton?: ButtonComponent;
  private modelRefreshTimer?: ReturnType<typeof setTimeout>;
  private modelRequestId = 0;
  private visible = false;

  constructor(app: App, plugin: TranslatePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.hide();
    this.visible = true;
    this.models = [];
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
      .setName("API type（接口类型）")
      .setDesc("Choose the interface supported by your provider（选择上游支持的接口）")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("chat-completions", "Chat Completions（聊天补全）")
          .addOption("responses", "Responses（响应）")
          .setValue(this.plugin.settings.apiType)
          .onChange(async (value) => {
            if (value !== "chat-completions" && value !== "responses") return;
            this.plugin.settings.apiType = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API URL")
      .setDesc("Host, base URL ending in /v1, or full endpoint（支持域名、以 /v1 结尾的基础地址或完整接口地址）")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value.trim();
            this.scheduleModelRefresh();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Your API key")
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            this.scheduleModelRefresh();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("Model（模型）")
      .setDesc("Choose from the list below or enter a model name（可从下方列表选择，也可手动输入）")
      .addText((text) => {
        this.modelText = text;
        text
          .setPlaceholder("gpt-4o-mini")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value.trim();
            this.updateModelDropdown();
            await this.plugin.saveSettings();
          });
      });

    this.modelListSetting = new Setting(containerEl)
      .setName("Available models（可用模型）")
      .addDropdown((dropdown) => {
        this.modelDropdown = dropdown;
        dropdown.onChange(async (value) => {
          if (!value) return;
          this.plugin.settings.model = value;
          this.modelText?.setValue(value);
          await this.plugin.saveSettings();
        });
      })
      .addButton((button) => {
        this.refreshButton = button;
        button.setButtonText("Refresh（刷新）").onClick(() => {
          void this.refreshModels();
        });
      });
    this.updateModelDropdown();

    new Setting(containerEl)
      .setName("Test model")
      .setDesc("Send a test request using the current API URL, key, and model")
      .addButton((btn) =>
        btn.setButtonText("Test").onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText("Testing...");
          try {
            const settings = { ...this.plugin.settings };
            const reply = await testModel(settings);
            new Notice(`Model (${settings.model}) responded: ${reply}`, 6000);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            new Notice(`Test failed: ${msg}`, 6000);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText("Test");
          }
        })
      );

    const temperatureSetting = new Setting(containerEl)
      .setName("Custom temperature（自定义温度）")
      .setDesc("Turn off if the model rejects temperature（模型不支持温度参数时关闭，使用上游默认值）");

    const temperatureSliderSetting = new Setting(containerEl)
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
    temperatureSliderSetting.setDisabled(!this.plugin.settings.sendTemperature);
    temperatureSetting.addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.sendTemperature)
        .onChange(async (value) => {
          this.plugin.settings.sendTemperature = value;
          temperatureSliderSetting.setDisabled(!value);
          await this.plugin.saveSettings();
        })
    );

    new Setting(containerEl)
      .setName("System prompt")
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

    void this.refreshModels();
  }

  hide(): void {
    this.visible = false;
    this.modelRequestId++;
    this.clearModelRefreshTimer();
  }

  private clearModelRefreshTimer(): void {
    if (this.modelRefreshTimer !== undefined) {
      clearTimeout(this.modelRefreshTimer);
      this.modelRefreshTimer = undefined;
    }
  }

  private updateModelDropdown(): void {
    const dropdown = this.modelDropdown;
    if (!dropdown) return;
    dropdown.selectEl.empty();
    dropdown.addOption("", "Choose a model（选择模型）");
    for (const model of this.models) dropdown.addOption(model, model);
    dropdown.setValue(this.models.includes(this.plugin.settings.model) ? this.plugin.settings.model : "");
    dropdown.selectEl.disabled = this.models.length === 0;
  }

  private scheduleModelRefresh(): void {
    this.clearModelRefreshTimer();
    // Invalidate in-flight results immediately, before the debounce expires.
    this.modelRequestId++;
    this.models = [];
    this.updateModelDropdown();
    this.refreshButton?.setDisabled(false);
    this.modelListSetting?.setDesc("Waiting for API settings（等待接口配置）…");
    this.modelRefreshTimer = setTimeout(() => {
      this.modelRefreshTimer = undefined;
      void this.refreshModels();
    }, 600);
  }

  private async refreshModels(): Promise<void> {
    this.clearModelRefreshTimer();
    if (!this.visible) return;
    const requestId = ++this.modelRequestId;
    const settings = { ...this.plugin.settings };
    this.models = [];
    this.updateModelDropdown();
    if (!settings.apiUrl || !settings.apiKey) {
      this.refreshButton?.setDisabled(false);
      this.modelListSetting?.setDesc("Enter an API URL and key to load models automatically（填写地址与密钥后自动获取模型）.");
      return;
    }

    this.refreshButton?.setDisabled(true);
    this.modelListSetting?.setDesc("Loading models（正在获取模型）…");
    try {
      const models = await fetchModels(settings);
      if (!this.visible || requestId !== this.modelRequestId) return;
      this.models = models;
      this.updateModelDropdown();
      this.modelListSetting?.setDesc(models.length > 0
        ? `${models.length} models loaded（已获取 ${models.length} 个模型）. Choose one, then test it（选择后可点击 Test 测试）.`
        : "No models returned. Enter a model manually（上游未返回模型，可手动输入）.");
    } catch (err) {
      if (!this.visible || requestId !== this.modelRequestId) return;
      const message = err instanceof Error ? err.message : String(err);
      this.modelListSetting?.setDesc(`Could not load models（获取模型失败）: ${message}. Enter a model manually（可手动输入模型）.`);
    } finally {
      if (this.visible && requestId === this.modelRequestId) {
        this.refreshButton?.setDisabled(false);
      }
    }
  }
}
