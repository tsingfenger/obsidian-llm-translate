import { Component, MarkdownRenderer } from "obsidian";

export class TranslatePopover {
  private containerEl: HTMLElement;
  private contentEl: HTMLElement;
  private actionsEl: HTMLElement;
  private result: string | null = null;
  private onReplace: ((text: string) => void) | null = null;
  private component: Component;
  private escHandler: (e: KeyboardEvent) => void;
  private clickOutsideHandler: (e: MouseEvent) => void;
  private _interacting = false;

  constructor(
    rect: DOMRect,
    component: Component,
    onReplace?: (text: string) => void
  ) {
    this.onReplace = onReplace ?? null;
    this.component = component;

    this.containerEl = document.createElement("div");
    this.containerEl.addClass("llm-translate-popover");

    // Header (drag handle)
    const headerEl = this.containerEl.createDiv("llm-translate-header");
    headerEl.createSpan({ text: "Translation", cls: "llm-translate-title" });
    const closeBtn = headerEl.createEl("button", {
      text: "×",
      cls: "llm-translate-close",
    });
    closeBtn.addEventListener("click", () => this.close());

    // Content
    this.contentEl = this.containerEl.createDiv("llm-translate-content");
    this.contentEl.createDiv({ cls: "llm-translate-loading", text: "Translating..." });

    // Actions — hidden until result arrives
    this.actionsEl = this.containerEl.createDiv("llm-translate-actions");
    this.actionsEl.addClass("llm-translate-hidden");

    // Resize handle (bottom-right corner)
    const resizeHandle = this.containerEl.createDiv("llm-translate-resize-handle");
    this.setupResize(resizeHandle);

    // Position & size
    this.setInitialSize();
    this.positionAt(rect);

    // Attach to DOM
    document.body.appendChild(this.containerEl);

    // Drag
    this.setupDrag(headerEl);

    // Close handlers
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.close();
    };
    this.clickOutsideHandler = (e: MouseEvent) => {
      if (!this.containerEl.contains(e.target as Node)) {
        this.close();
      }
    };
    document.addEventListener("keydown", this.escHandler);
    setTimeout(() => {
      document.addEventListener("mousedown", this.clickOutsideHandler);
    }, 100);
  }

  /** Set initial width to half the article pane width */
  private setInitialSize(): void {
    const articleEl =
      document.querySelector<HTMLElement>(".markdown-source-view .cm-content") ??
      document.querySelector<HTMLElement>(".markdown-preview-view");

    const articleWidth = articleEl?.offsetWidth ?? 0;
    const initialWidth = articleWidth > 200 ? Math.round(articleWidth / 2) : 400;
    this.containerEl.style.width = `${initialWidth}px`;
  }

  private positionAt(rect: DOMRect): void {
    const margin = 8;
    const popoverWidth = this.containerEl.offsetWidth || 400;
    const popoverHeight = 200;

    let top = rect.bottom + margin;
    let left = rect.left;

    if (left + popoverWidth > window.innerWidth) {
      left = window.innerWidth - popoverWidth - margin;
    }
    if (left < margin) left = margin;

    if (top + popoverHeight > window.innerHeight) {
      top = rect.top - popoverHeight - margin;
    }
    if (top < margin) top = margin;

    this.containerEl.style.top = `${top}px`;
    this.containerEl.style.left = `${left}px`;
  }

  /** Make the popover draggable by its header */
  private setupDrag(handle: HTMLElement): void {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    const onMouseMove = (e: MouseEvent) => {
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

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".llm-translate-close")) return;
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
  private setupResize(handle: HTMLElement): void {
    let startX = 0, startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const newWidth = Math.max(200, startWidth + dx);
      this.containerEl.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      this._interacting = false;
    };

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this._interacting = true;
      startX = e.clientX;
      startWidth = this.containerEl.offsetWidth;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  async setResult(text: string): Promise<void> {
    this.result = text;
    this.contentEl.empty();
    const resultEl = this.contentEl.createDiv({ cls: "llm-translate-result" });
    await MarkdownRenderer.render(
      this.component.app,
      text,
      resultEl,
      "",
      this.component
    );

    this.actionsEl.removeClass("llm-translate-hidden");
    const copyBtn = this.actionsEl.createEl("button", {
      text: "Copy",
      cls: "llm-translate-btn",
    });
    copyBtn.addEventListener("click", () => { void this.copyResult(); });

    if (this.onReplace) {
      const replaceBtn = this.actionsEl.createEl("button", {
        text: "Replace",
        cls: "llm-translate-btn",
      });
      replaceBtn.addEventListener("click", () => this.replaceSelection());
    }
  }

  setError(message: string): void {
    this.contentEl.empty();
    this.contentEl.createDiv({ text: message, cls: "llm-translate-error" });
  }

  private async copyResult(): Promise<void> {
    if (this.result) {
      await navigator.clipboard.writeText(this.result);
    }
  }

  private replaceSelection(): void {
    if (this.result && this.onReplace) {
      this.onReplace(this.result);
      this.close();
    }
  }

  close(): void {
    document.removeEventListener("keydown", this.escHandler);
    document.removeEventListener("mousedown", this.clickOutsideHandler);
    this.containerEl.remove();
  }

  isOpen(): boolean {
    return this.containerEl.isConnected;
  }

  containsTarget(el: HTMLElement): boolean {
    return this.containerEl.contains(el);
  }

  isInteracting(): boolean {
    return this._interacting;
  }
}
