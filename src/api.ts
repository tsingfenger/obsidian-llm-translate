import { requestUrl } from "obsidian";
import type { TranslatePluginSettings } from "./settings";

type ApiConnection = Pick<TranslatePluginSettings, "apiUrl" | "apiKey">;
type ApiEndpoint = "chat/completions" | "responses" | "models";

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/** Accept a host, a versioned base URL, or a complete API endpoint. */
export function buildApiUrl(apiUrl: string, endpoint: ApiEndpoint): string {
  let url: URL;
  try {
    url = new URL(apiUrl.trim());
  } catch {
    throw new Error("Invalid API URL（接口地址无效）. Enter an HTTP or HTTPS URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid API URL（接口地址无效）. Use HTTP or HTTPS.");
  }

  let path = url.pathname.replace(/\/+$/, "");
  const suffix = path.match(/\/(chat\/completions|responses?|models)$/);
  if (suffix) {
    path = path.slice(0, -suffix[0].length);
  } else if (!/\/v\d+(?:beta\d*)?$/.test(path)) {
    path += "/v1";
  }

  // Some gateways expose the singular alias as an explicit endpoint.
  const route = endpoint === "responses" && suffix?.[1] === "response"
    ? "response"
    : endpoint;
  url.pathname = `${path}/${route}`;
  url.hash = "";
  return url.toString();
}

function errorDetail(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 500);
  const error = asRecord(value);
  if (!error) return "";
  return [error.message, error.code ?? error.type]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" — ")
    .slice(0, 500);
}

export async function requestApi(
  settings: ApiConnection,
  endpoint: ApiEndpoint,
  body?: Record<string, unknown>
): Promise<unknown> {
  if (!settings.apiKey.trim()) {
    throw new Error("API key is not configured（未配置 API 密钥）. Please set it in plugin settings.");
  }
  const url = buildApiUrl(settings.apiUrl, endpoint);
  let response;
  try {
    response = await requestUrl({
      url,
      method: body ? "POST" : "GET",
      throw: false,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    throw new Error(`Network error（网络错误）: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parsing text explicitly also handles HTML/plain-text proxy errors safely.
  let data: unknown;
  try {
    data = JSON.parse(response.text);
  } catch {
    throw new Error(`HTTP ${response.status}: upstream returned a non-JSON response（上游返回了非 JSON 响应）.`);
  }

  const error = asRecord(data)?.error;
  const detail = errorDetail(error);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  if (error) {
    throw new Error(`API error（接口错误）${detail ? `: ${detail}` : ""}`);
  }
  return data;
}

/** Discover model IDs without changing the user's selected model. */
export async function fetchModels(settings: ApiConnection): Promise<string[]> {
  const data = asRecord(await requestApi(settings, "models"))?.data;
  if (!Array.isArray(data)) {
    throw new Error("Unexpected model list format（模型列表格式异常）: expected a data array.");
  }

  const ids: string[] = [];
  for (const item of data) {
    const id = asRecord(item)?.id;
    if (typeof id === "string" && id.trim()) ids.push(id.trim());
  }
  if (data.length > 0 && ids.length === 0) {
    throw new Error("No valid model IDs in response（响应中没有有效的模型名称）.");
  }
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
