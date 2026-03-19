# LLM Translate

An Obsidian plugin that translates selected text using any OpenAI-compatible LLM API.

## Features

- **Multiple trigger modes** — hotkey, right-click context menu, or auto-translate on text selection
- **Works in both editing and reading mode**
- **Replace or Copy** — replace selected text directly in editing mode, or copy the translation in reading mode
- **Draggable & resizable popover** — translation results are shown in a floating panel with Markdown rendering support
- **Any OpenAI-compatible API** — works with OpenAI, Azure OpenAI, Gemini, Claude, local models (Ollama, LM Studio), or any service exposing a `/v1/chat/completions` endpoint
- **Customizable system prompt** — full control over translation behavior (language pairs, tone, terminology preservation, etc.)

## Installation

### From Community Plugins (coming soon)

1. Open **Settings → Community plugins → Browse**
2. Search for **LLM Translate**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/tsingfenger/obsidian-llm-translate/releases/latest)
2. Create a folder `obsidian-llm-translate` inside your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the folder
4. Restart Obsidian and enable the plugin in **Settings → Community plugins**

## Configuration

Open **Settings → LLM Translate** to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| API URL | OpenAI-compatible API base URL | `https://api.openai.com` |
| API Key | Your API key | — |
| Model | Model name | `gpt-4o-mini` |
| Temperature | Controls randomness (0–2) | `0.3` |
| System Prompt | Instructions sent to the LLM | Auto-detect language, translate between Chinese and English |
| Auto-translate | Translate on text selection automatically | Off |
| Auto-translate delay | Delay (ms) before auto-translate triggers | `500` |

Use the **Test** button in settings to verify your API connection.

## Usage

### Hotkey

1. Select text in any markdown view
2. Open the command palette and run **LLM Translate: Translate selection**, or bind it to a hotkey in **Settings → Hotkeys**

### Right-click Menu

Select text → right-click → **Translate selection**

### Auto-translate

Click the **Languages** icon in the left ribbon (or toggle in settings) to enable auto-translate. Once enabled, any text selection will automatically trigger translation after a short delay.

### Popover Actions

- **Copy** — copy the translation to clipboard
- **Replace** — replace the selected text with the translation (editing mode only)
- Drag the header to move the popover
- Drag the bottom-right corner to resize
- Press `Esc` or click outside to dismiss

## Build from Source

```bash
npm install
npm run build
```

For development with auto-rebuild:

```bash
npm run dev
```

## License

[MIT](LICENSE)
