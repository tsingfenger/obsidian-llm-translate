import { asRecord, requestApi } from "./api";
import type { TranslatePluginSettings } from "./settings";

function responseText(data: unknown): string {
  const response = asRecord(data);
  if (!response) throw new Error("Unexpected Responses format（响应格式异常）.");
  if (response.status && response.status !== "completed") {
    const reason = asRecord(response.incomplete_details)?.reason;
    throw new Error(`Response not completed（响应未完成）: ${response.status}${typeof reason === "string" ? ` — ${reason}` : ""}`);
  }

  const parts: string[] = [];
  if (Array.isArray(response.output)) {
    for (const value of response.output) {
      const item = asRecord(value);
      if (item?.type !== "message" || item.role !== "assistant" || !Array.isArray(item.content)) continue;
      if (item.status && item.status !== "completed") {
        throw new Error(`Response message not completed（响应消息未完成）: ${item.status}`);
      }
      for (const value of item.content) {
        const part = asRecord(value);
        if (part?.type === "refusal") {
          throw new Error(`Model refused the request（模型拒绝了请求）: ${part.refusal ?? ""}`);
        }
        if (part?.type === "output_text" && typeof part.text === "string") {
          parts.push(part.text);
        }
      }
    }
  }
  // Some compatible gateways return the SDK-style aggregate directly.
  return parts.length > 0
    ? parts.join("")
    : typeof response.output_text === "string" ? response.output_text : "";
}

function chatText(data: unknown): string {
  const choices = asRecord(data)?.choices;
  const choice = Array.isArray(choices) ? asRecord(choices[0]) : undefined;
  const message = asRecord(choice?.message);
  if (message?.refusal) {
    throw new Error(`Model refused the request（模型拒绝了请求）: ${message.refusal}`);
  }
  if (choice?.finish_reason === "length" || choice?.finish_reason === "content_filter") {
    throw new Error(`Translation not completed（翻译未完成）: ${choice.finish_reason}`);
  }
  return typeof message?.content === "string" ? message.content : "";
}

export async function translate(
  text: string,
  settings: TranslatePluginSettings
): Promise<string> {
  if (!settings.model.trim()) {
    throw new Error("Model is not configured（未配置模型）. Please choose or enter a model.");
  }

  const useResponses = settings.apiType === "responses";
  const body: Record<string, unknown> = {
    model: settings.model.trim(),
    ...(settings.sendTemperature !== false ? { temperature: settings.temperature } : {}),
    ...(useResponses ? {
      instructions: settings.systemPrompt,
      input: [{ role: "user", content: [{ type: "input_text", text }] }],
      store: false,
      stream: false,
    } : {
      messages: [
        { role: "system", content: settings.systemPrompt },
        { role: "user", content: text },
      ],
    }),
  };
  const data = await requestApi(settings, useResponses ? "responses" : "chat/completions", body);
  const content = (useResponses ? responseText(data) : chatText(data)).trim();
  if (!content) {
    throw new Error("Unexpected API response format（接口响应格式异常）: no translated text in response.");
  }

  return content;
}

/** Test the configured model by sending a minimal request. Returns the model's reply. */
export async function testModel(settings: TranslatePluginSettings): Promise<string> {
  return translate("Hello", { ...settings, systemPrompt: "Reply with exactly: OK" });
}
