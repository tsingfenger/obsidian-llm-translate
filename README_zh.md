[English](README.md) | 中文

# LLM Translate

一款 Obsidian 插件，通过任意 OpenAI 兼容的 LLM API 翻译选中文本。

## 功能特性

- **多种触发方式** — 快捷键、右键菜单、选中文本自动翻译
- **编辑模式和阅读模式均可使用**
- **替换或复制** — 编辑模式下可直接替换选中文本，阅读模式下可复制翻译结果
- **可拖拽、可调整大小的弹窗** — 翻译结果以浮动面板展示，支持 Markdown 渲染
- **支持两种 OpenAI 兼容接口** — 可选择 Chat Completions（聊天补全，`/v1/chat/completions`）或 Responses（响应，`/v1/responses`），支持提供对应接口的中转服务和本地模型服务
- **自动获取模型列表** — 打开设置或修改地址、密钥后自动读取上游 `/v1/models`，支持手动刷新，也可直接填写模型名称
- **自定义系统提示词** — 完全控制翻译行为（语言对、语气、术语保留等）

## 安装

### 从社区插件安装（即将上线）

1. 打开 **设置 → 第三方插件 → 浏览**
2. 搜索 **LLM Translate**
3. 点击 **安装**，然后 **启用**

### 手动安装

1. 从 [最新发布](https://github.com/tsingfenger/obsidian-llm-translate/releases/latest) 下载 `main.js`、`manifest.json` 和 `styles.css`
2. 在 Vault 的 `.obsidian/plugins/` 目录下创建 `obsidian-llm-translate` 文件夹
3. 将下载的文件复制到该文件夹中
4. 重启 Obsidian，在 **设置 → 第三方插件** 中启用插件

## 配置说明

打开 **设置 → LLM Translate** 进行配置：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| API type（接口类型） | Chat Completions（聊天补全）或 Responses（响应） | Chat Completions（聊天补全） |
| API URL（接口地址） | 域名、带版本的基础地址或完整接口地址 | `https://api.openai.com` |
| API Key | API 密钥 | — |
| Model（模型） | 从可用模型列表选择，或手动填写名称 | `gpt-4o-mini` |
| Available models（可用模型） | 自动获取的模型列表，可点击 Refresh（刷新）重新获取 | — |
| Custom temperature（自定义温度） | 是否发送温度参数；模型不支持时可关闭 | 开启 |
| Temperature | 随机性控制（0–2） | `0.3` |
| System Prompt | 发送给 LLM 的系统提示词 | 自动检测语言，中英互译 |
| Auto-translate | 选中文本自动翻译 | 关闭 |
| Auto-translate delay | 自动翻译触发延迟（毫秒） | `500` |

配置完成后可点击设置中的 **Test（测试）** 按钮验证 API 连接。

### 使用 Responses（响应）接口

1. 将 **API type（接口类型）** 设为 **Responses（响应）**。
2. 填写接口地址和密钥。例如，`https://api.openai.com`、`https://api.openai.com/v1` 和 `https://api.openai.com/v1/responses` 都会请求标准 Responses 接口；`https://example.com/proxy/v1` 这类地址中的代理路径也会保留。如果上游明确使用单数形式的 `/v1/response`，请填写该完整地址。
3. 从 **Available models（可用模型）** 中选择模型，或在 **Model（模型）** 中手动填写。列表按上游返回结果展示，其中可能包含不能翻译文本或不支持当前接口的模型，可点击 **Test（测试）** 验证所选模型。
4. 如果模型拒绝 `temperature`（温度）参数，关闭 **Custom temperature（自定义温度）**，使用上游默认值。

翻译和测试都会使用所选接口。Responses 请求通过 `instructions` 传递系统提示词，通过 `input` 传递选中文本，并设置 `store: false`。目前使用非流式 JSON 响应（`stream: false`）。已有配置默认继续使用 Chat Completions（聊天补全），可自行切换接口类型。

模型列表使用相同的地址前缀和密钥，通过 `GET /v1/models` 获取。打开设置时会自动获取；修改地址或密钥后，会在停止输入片刻后重新获取。刷新列表不会更改已选模型。上游未提供模型列表时，仍可手动填写模型并翻译。

## 使用方法

### 快捷键

1. 在任意 Markdown 视图中选中文本
2. 打开命令面板执行 **LLM Translate: Translate selection**，或在 **设置 → 快捷键** 中为其绑定快捷键

### 右键菜单

选中文本 → 右键 → **Translate selection**

### 自动翻译

点击左侧功能区的 **Languages** 图标（或在设置中开启）启用自动翻译。启用后，选中文本将在短暂延迟后自动触发翻译。

### 弹窗操作

- **Copy** — 复制翻译结果到剪贴板
- **Replace** — 用翻译结果替换选中文本（仅编辑模式）
- 拖拽顶部标题栏可移动弹窗
- 拖拽右下角可调整宽度
- 按 `Esc` 或点击弹窗外部关闭

## 从源码构建

```bash
npm ci
npm run check
```

需要 Node.js 20 或更高版本。`npm run check` 依次执行 TypeScript 类型检查、自动化测试和生产构建；`npm run build` 仅重新生成 `main.js`。

测试覆盖两种接口协议、地址处理、鉴权、模型列表、上游错误、旧配置兼容，以及设置交互中的过期请求等情况。HTTP 集成测试使用本地模拟上游，无需真实密钥。实际服务可在 Obsidian 中点击 **Test（测试）** 验证。

开发模式（自动重新构建）：

```bash
npm run dev
```

## 许可证

[MIT](LICENSE)
