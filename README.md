[中文](README_zh.md) | English

# LLM Translate

An Obsidian plugin that translates selected text using any OpenAI-compatible LLM API.

## Features

- **Multiple trigger modes** — hotkey, right-click context menu, or auto-translate on text selection
- **Works in both editing and reading mode**
- **Replace or Copy** — replace selected text directly in editing mode, or copy the translation in reading mode
- **Draggable & resizable popover** — translation results are shown in a floating panel with Markdown rendering support
- **Two OpenAI-compatible interfaces** — choose Chat Completions (`/v1/chat/completions`) or Responses (`/v1/responses`), including compatible gateways and local model servers
- **Automatic model discovery** — loads your provider's `/v1/models` list when settings open or the URL/key changes, with manual refresh and model entry as a fallback
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
| API type | Chat Completions or Responses | Chat Completions |
| API URL | Host, versioned base URL, or full endpoint | `https://api.openai.com` |
| API Key | Your API key | — |
| Model | Select an available model or enter its name manually | `gpt-4o-mini` |
| Available models | Automatically fetched model list; **Refresh** reloads it | — |
| Custom temperature | Send the configured temperature; turn off for models that do not support it | On |
| Temperature | Controls randomness (0–2) | `0.3` |
| System Prompt | Instructions sent to the LLM | Auto-detect language, translate between Chinese and English |
| Auto-translate | Translate on text selection automatically | Off |
| Auto-translate delay | Delay (ms) before auto-translate triggers | `500` |

Use the **Test** button in settings to verify your API connection.

### Responses API

1. Choose **Responses** under **API type**.
2. Enter your API URL and key. For example, `https://api.openai.com`, `https://api.openai.com/v1`, and `https://api.openai.com/v1/responses` all target the standard Responses endpoint. Proxy prefixes such as `https://example.com/proxy/v1` are preserved. If your gateway specifically uses the singular `/v1/response` alias, enter that full URL.
3. Choose a model from **Available models**, or enter its name in **Model**. The list reflects what the provider returns and may include models that cannot translate text or use the selected interface; use **Test** to check the selected model.
4. If the model rejects the `temperature` parameter, turn off **Custom temperature** to use the provider's default.

Translation and **Test** both use the selected interface. Responses requests send the system prompt as `instructions`, the selected text as `input`, and `store: false`. They currently use non-streaming JSON responses (`stream: false`). Existing saved configurations continue to use Chat Completions until you change **API type**.

Model discovery uses the same URL prefix and API key for `GET /v1/models`. It runs when the settings tab opens and shortly after URL/key edits stop. Refreshing the list never changes your chosen model. If the provider does not expose a model list, manual entry and translation remain available.

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
npm ci
npm run check
```

Use Node.js 20 or newer. `npm run check` runs TypeScript checking, automated tests, and the production build. `npm run build` only rebuilds `main.js`.

The tests cover both API protocols, URL normalization, authentication, model discovery, provider errors, legacy settings, and settings interactions including stale requests. HTTP integration tests use a local mock provider and do not require a real API key. Use **Test** in Obsidian to verify your actual provider.

For development with auto-rebuild:

```bash
npm run dev
```

## License

[MIT](LICENSE)
