import { Editor, MarkdownView, Menu, Notice, Plugin } from "obsidian";
import {
  DEFAULT_SETTINGS,
  TranslateSettingTab,
  type TranslatePluginSettings,
} from "./settings";
import { translate } from "./translator";
import { TranslatePopover } from "./popover";

export default class TranslatePlugin extends Plugin {
  settings: TranslatePluginSettings = DEFAULT_SETTINGS;
  private popover: TranslatePopover | null = null;
  private _translateSeq = 0;
  private ribbonEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new TranslateSettingTab(this.app, this));

    // Ribbon button to toggle auto-translate
    this.ribbonEl = this.addRibbonIcon(
      "languages",
      "Toggle auto-translate",
      () => this.toggleAutoTranslate()
    );
    this.updateRibbonIcon();

    // Command with hotkey support — works in both editor and reading mode
    this.addCommand({
      id: "translate-selection",
      name: "Translate selection",
      callback: () => this.handleTranslateCommand(),
    });

    // Right-click context menu in editor mode
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const selection = editor.getSelection();
        if (selection) {
          menu.addItem((item) => {
            item
              .setTitle("Translate selection")
              .setIcon("languages")
              .onClick(() => this.translateWithEditor(editor));
          });
        }
      })
    );

    // Auto-translate on mouse-up selection
    this.registerDomEvent(document, "mouseup", (evt: MouseEvent) => {
      if (!this.settings.autoTranslate) return;

      // Ignore clicks inside the popover or drag/resize interactions
      if (this.popover?.isOpen() &&
          (this.popover.containsTarget(evt.target as HTMLElement) ||
           this.popover.isInteracting())) return;

      // Must be inside a markdown view (editor or preview)
      const target = evt.target as HTMLElement;
      const inMarkdown =
        target.closest(".markdown-source-view") ||
        target.closest(".markdown-preview-view");
      if (!inMarkdown) return;

      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!text || !sel || sel.rangeCount === 0) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.getMode() === "source") {
          void this.translateWithEditor(view.editor);
        } else {
          void this.translateFromDOM();
        }
      }, this.settings.autoTranslateDelay);
    });

    // Right-click context menu in reading mode
    this.registerDomEvent(document, "contextmenu", (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (!target.closest(".markdown-preview-view")) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text) return;

      // Prevent default browser context menu
      evt.preventDefault();

      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle("Translate selection")
          .setIcon("languages")
          .onClick(() => this.translateFromDOM());
      });
      menu.showAtMouseEvent(evt);
    });
  }

  onunload(): void {
    this.closePopover();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private closePopover(): void {
    if (this.popover) {
      this.popover.close();
      this.popover = null;
    }
  }

  async toggleAutoTranslate(): Promise<void> {
    this.settings.autoTranslate = !this.settings.autoTranslate;
    await this.saveSettings();
    this.updateRibbonIcon();
    new Notice(`Auto-translate ${this.settings.autoTranslate ? "enabled" : "disabled"}`);
  }

  updateRibbonIcon(): void {
    if (!this.ribbonEl) return;
    this.ribbonEl.toggleClass("is-active", this.settings.autoTranslate);
  }

  /** Hotkey handler: detect current mode and dispatch accordingly */
  private handleTranslateCommand(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice("No active Markdown view");
      return;
    }

    if (view.getMode() === "source") {
      void this.translateWithEditor(view.editor);
    } else {
      void this.translateFromDOM();
    }
  }

  /** Translate in editor mode — supports Replace */
  private async translateWithEditor(editor: Editor): Promise<void> {
    const text = editor.getSelection();
    if (!text) {
      new Notice("No text selected");
      return;
    }

    this.closePopover();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      new Notice("Could not determine selection position");
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();

    this.popover = new TranslatePopover(rect, this, (replacement: string) => {
      editor.replaceSelection(replacement);
    });

    await this.doTranslate(text);
  }

  /** Translate in reading mode — Copy only, no Replace */
  private async translateFromDOM(): Promise<void> {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !sel || sel.rangeCount === 0) {
      new Notice("No text selected");
      return;
    }

    this.closePopover();

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    this.popover = new TranslatePopover(rect, this); // no onReplace → no Replace button
    await this.doTranslate(text);
  }

  /** Shared translate + popover update logic */
  private async doTranslate(text: string): Promise<void> {
    const seq = ++this._translateSeq;
    try {
      const result = await translate(text, this.settings);
      if (seq !== this._translateSeq) return; // superseded by a newer request
      if (this.popover?.isOpen()) {
        void this.popover.setResult(result);
      }
    } catch (err) {
      if (seq !== this._translateSeq) return;
      const message = err instanceof Error ? err.message : String(err);
      if (this.popover?.isOpen()) {
        this.popover.setError(message);
      } else {
        new Notice(`Translation failed: ${message}`);
      }
    }
  }
}
