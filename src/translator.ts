import { requestUrl } from "obsidian";
import type { TranslatePluginSettings } from "./settings";

export async function translate(
  text: string,
  settings: TranslatePluginSettings
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error("API Key is not configured. Please set it in plugin settings.");
  }

  const url = `${settings.apiUrl.replace(/\/+$/, "")}/v1/chat/completions`;

  let response;
  try {
    response = await requestUrl({
      url,
      method: "POST",
      throw: false,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        messages: [
          { role: "system", content: settings.systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (response.status !== 200) {
    const apiMsg = response.json?.error?.message;
    const code = response.json?.error?.code ?? response.json?.error?.type ?? "";
    const detail = [apiMsg, code].filter(Boolean).join(" — ");
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const content = response.json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Unexpected API response format: no content in response.");
  }

  return content.trim();
}

/** Test the configured model by sending a minimal request. Returns the model's reply. */
export async function testModel(settings: TranslatePluginSettings): Promise<string> {
  return translate("Hello", { ...settings, systemPrompt: "Reply with exactly: OK" });
}
