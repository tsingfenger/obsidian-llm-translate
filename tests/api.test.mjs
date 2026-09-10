import assert from "node:assert/strict";
import { test } from "node:test";
import { loadModule, apiResponse, localRequestUrl, withServer, reply, completedResponse } from "./helpers.mjs";

const api = loadModule("src/api.ts", { requestUrl: localRequestUrl });
const translator = loadModule("src/translator.ts", { requestUrl: localRequestUrl });
const settings = {
  apiUrl: "https://example.com",
  apiKey: "test-key",
  apiType: "chat-completions",
  model: "test-model",
  temperature: 0.3,
  sendTemperature: true,
  systemPrompt: "Translate to Chinese.",
};

test("URL normalization supports hosts, versioned/proxy bases, full endpoints, and query strings", () => {
  const cases = [
    [" https://example.com/// ", "https://example.com/v1"],
    ["https://example.com/v1/", "https://example.com/v1"],
    ["https://example.com/proxy/v1", "https://example.com/proxy/v1"],
    ["https://example.com/proxy", "https://example.com/proxy/v1"],
    ["https://example.com/v2", "https://example.com/v2"],
    ["https://example.com/v1/chat/completions/", "https://example.com/v1"],
    ["https://example.com/v1/responses", "https://example.com/v1"],
    ["https://example.com/custom/responses", "https://example.com/custom"],
    ["https://example.com/v1/models", "https://example.com/v1"],
  ];
  for (const [input, base] of cases) {
    for (const endpoint of ["chat/completions", "responses", "models"]) {
      assert.equal(api.buildApiUrl(input, endpoint), `${base}/${endpoint}`);
    }
  }
  assert.equal(api.buildApiUrl("https://example.com/v1/responses?api-version=2025-01-01#ignored", "models"),
    "https://example.com/v1/models?api-version=2025-01-01");
  assert.equal(api.buildApiUrl("https://example.com/v1/response", "responses"), "https://example.com/v1/response");
  assert.equal(api.buildApiUrl("https://example.com/v1/response", "models"), "https://example.com/v1/models");
  for (const invalid of ["", "example.com", "file:///tmp/file", "javascript:alert(1)"]) {
    assert.throws(() => api.buildApiUrl(invalid, "models"), /Invalid API URL/);
  }
});

test("existing Chat Completions configurations still translate over HTTP", async () => {
  await withServer((request, response) => {
    assert.equal(request.url, "/v1/chat/completions");
    assert.equal(request.method, "POST");
    assert.equal(request.headers.authorization, "Bearer test-key");
    assert.equal(request.headers["content-type"], "application/json");
    assert.deepEqual(request.body, {
      model: "test-model", temperature: 0.3,
      messages: [{ role: "system", content: settings.systemPrompt }, { role: "user", content: "Hello" }],
    });
    reply(response, { choices: [{ message: { content: "  你好\n" }, finish_reason: "stop" }] });
  }, async (apiUrl) => {
    // Older saved configurations have neither of the new settings.
    const { apiType, sendTemperature, ...legacy } = settings;
    assert.equal(await translator.translate("Hello", { ...legacy, apiUrl }), "你好");
  });
});

test("Responses sends the selected model, instructions, typed input, and storage opt-out", async () => {
  await withServer((request, response) => {
    assert.equal(request.url, "/proxy/v1/responses");
    assert.equal(request.method, "POST");
    assert.equal(request.headers.authorization, "Bearer test-key");
    assert.deepEqual(request.body, {
      model: "test-model", temperature: 0.3, instructions: settings.systemPrompt,
      input: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
      store: false, stream: false,
    });
    const result = completedResponse("  你");
    result.output[1].content.push({ type: "output_text", text: "好\n" });
    reply(response, result);
  }, async (apiUrl) => {
    assert.equal(await translator.translate("Hello", { ...settings, apiUrl: `${apiUrl}/proxy/v1`, apiType: "responses" }), "你好");
  });
});

test("the singular gateway endpoint is honored and temperature can be omitted", async () => {
  await withServer((request, response) => {
    assert.equal(request.url, "/v1/response");
    assert.equal("temperature" in request.body, false);
    reply(response, completedResponse());
  }, async (apiUrl) => {
    assert.equal(await translator.translate("Hello", {
      ...settings, apiUrl: `${apiUrl}/v1/response`, apiType: "responses", sendTemperature: false,
    }), "你好");
  });
});

test("model discovery uses the same prefix and credentials, filters IDs, deduplicates and sorts", async () => {
  await withServer((request, response) => {
    assert.equal(request.url, "/proxy/v1/models");
    assert.equal(request.method, "GET");
    assert.equal(request.headers.authorization, "Bearer test-key");
    assert.equal(request.body, undefined);
    reply(response, { object: "list", data: [{ id: "z-model" }, { id: "a-model" }, { id: "z-model" }, null, { id: 2 }, { id: " " }] });
  }, async (apiUrl) => {
    const models = await api.fetchModels({ ...settings, apiUrl: `${apiUrl}/proxy/v1/responses` });
    assert.deepEqual(Array.from(models), ["a-model", "z-model"]);
  });
});

test("the Test button's request uses the selected protocol without mutating the prompt", async () => {
  for (const apiType of ["chat-completions", "responses"]) {
    await withServer((request, response) => {
      if (apiType === "responses") {
        assert.equal(request.url, "/v1/responses");
        assert.equal(request.body.instructions, "Reply with exactly: OK");
        reply(response, completedResponse("OK"));
      } else {
        assert.equal(request.url, "/v1/chat/completions");
        assert.equal(request.body.messages[0].content, "Reply with exactly: OK");
        assert.equal("temperature" in request.body, false);
        reply(response, { choices: [{ message: { content: "OK" } }] });
      }
    }, async (apiUrl) => {
      const config = { ...settings, apiUrl, apiType, sendTemperature: false };
      assert.equal(await translator.testModel(config), "OK");
      assert.equal(config.systemPrompt, settings.systemPrompt);
    });
  }
});

test("Responses extracts only assistant text across output items or accepts the aggregate", async () => {
  const fixtures = [
    [{ ...completedResponse("你"), output: [
      ...completedResponse("你").output,
      { type: "message", role: "user", content: [{ type: "output_text", text: "ignored" }] },
      { type: "function_call", arguments: "ignored" },
      completedResponse("好").output[1],
    ] }, "你好"],
    [{ output_text: "  你好  " }, "你好"],
    [{ ...completedResponse("你好"), output_text: "你好" }, "你好"],
  ];
  for (const [data, expected] of fixtures) {
    const client = loadModule("src/translator.ts", { requestUrl: async () => apiResponse(data) });
    assert.equal(await client.translate("Hello", { ...settings, apiType: "responses" }), expected);
  }
});

test("Responses refuses failed, truncated, pending, refused, empty and malformed results", async () => {
  const fixtures = [
    [{ ...completedResponse(), status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, /not completed.*max_output_tokens/],
    [{ status: "failed", error: { message: "Provider failed", code: "server_error" } }, /Provider failed.*server_error/],
    [{ ...completedResponse(), status: "queued" }, /not completed.*queued/],
    [{ ...completedResponse(), output: [{ ...completedResponse().output[1], status: "incomplete" }] }, /message not completed/],
    [{ output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "Cannot translate" }] }] }, /refused.*Cannot translate/],
    [{ output: [completedResponse().output[0]] }, /no translated text/],
    [{ output: {} }, /no translated text/],
    [{ output_text: "  " }, /no translated text/],
    [null, /Unexpected Responses format/],
  ];
  for (const [data, expected] of fixtures) {
    const client = loadModule("src/translator.ts", { requestUrl: async () => apiResponse(data) });
    await assert.rejects(client.translate("Hello", { ...settings, apiType: "responses" }), expected);
  }
});

test("Chat Completions rejects missing, refused, or truncated translations", async () => {
  for (const [data, expected] of [
    [{ choices: [] }, /no translated text/],
    [{ choices: [{ message: { content: " " } }] }, /no translated text/],
    [{ choices: [{ message: { refusal: "Cannot translate" } }] }, /refused.*Cannot translate/],
    [{ choices: [{ finish_reason: "length", message: { content: "partial" } }] }, /not completed.*length/],
    [{ choices: [{ finish_reason: "content_filter", message: { content: "partial" } }] }, /not completed.*content_filter/],
  ]) {
    const client = loadModule("src/translator.ts", { requestUrl: async () => apiResponse(data) });
    await assert.rejects(client.translate("Hello", settings), expected);
  }
});

test("API errors preserve HTTP status and provider details, including non-JSON failures", async () => {
  for (const [status, data, expected] of [
    [401, { error: { message: "Invalid key", code: "invalid_api_key" } }, /HTTP 401.*Invalid key.*invalid_api_key/],
    [429, { error: { message: "Slow down", type: "rate_limit" } }, /HTTP 429.*Slow down.*rate_limit/],
    [500, { error: "Unavailable" }, /HTTP 500.*Unavailable/],
    [502, "<html>Bad gateway</html>", /HTTP 502.*non-JSON/],
    [200, "not JSON", /HTTP 200.*non-JSON/],
    [200, { error: { message: "Provider failure" } }, /API error.*Provider failure/],
  ]) {
    await withServer((_request, response) => {
      response.writeHead(status);
      response.end(typeof data === "string" ? data : JSON.stringify(data));
    }, async (apiUrl) => {
      await assert.rejects(api.fetchModels({ ...settings, apiUrl }), expected);
    });
  }
});

test("model discovery distinguishes empty lists from invalid data and reports network failures", async () => {
  const empty = loadModule("src/api.ts", { requestUrl: async () => apiResponse({ data: [] }) });
  assert.deepEqual(Array.from(await empty.fetchModels(settings)), []);
  for (const data of [{ models: [] }, { data: null }, { data: [null, {}, { id: "" }] }]) {
    const client = loadModule("src/api.ts", { requestUrl: async () => apiResponse(data) });
    await assert.rejects(client.fetchModels(settings), /model list format|No valid model IDs/);
  }
  const offline = loadModule("src/api.ts", { requestUrl: async () => { throw new Error("offline"); } });
  await assert.rejects(offline.fetchModels(settings), /Network error.*offline/);
});

test("missing credentials or model and invalid URLs fail before making a request", async () => {
  let calls = 0;
  const client = loadModule("src/translator.ts", { requestUrl: async () => { calls++; return apiResponse({}); } });
  await assert.rejects(client.translate("Hello", { ...settings, apiKey: " " }), /not configured/);
  await assert.rejects(client.translate("Hello", { ...settings, model: " " }), /Model is not configured/);
  await assert.rejects(client.translate("Hello", { ...settings, apiUrl: "invalid" }), /Invalid API URL/);
  assert.equal(calls, 0);
});
