[English](README.md) | 中文

# LLM Translate

一款 Obsidian 插件，通过任意 OpenAI 兼容的 LLM API 翻译选中文本。

## 功能特性

- **多种触发方式** — 快捷键、右键菜单、选中文本自动翻译
- **编辑模式和阅读模式均可使用**
- **替换或复制** — 编辑模式下可直接替换选中文本，阅读模式下可复制翻译结果
- **可拖拽、可调整大小的弹窗** — 翻译结果以浮动面板展示，支持 Markdown 渲染
- **兼容任意 OpenAI 格式 API** — 支持 OpenAI、Azure OpenAI、Gemini、Claude、本地模型（Ollama、LM Studio）等任何提供 `/v1/chat/completions` 接口的服务
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
| API URL | OpenAI 兼容的 API 地址 | `https://api.openai.com` |
| API Key | API 密钥 | — |
| Model | 模型名称 | `gpt-4o-mini` |
| Temperature | 随机性控制（0–2） | `0.3` |
| System Prompt | 发送给 LLM 的系统提示词 | 自动检测语言，中英互译 |
| Auto-translate | 选中文本自动翻译 | 关闭 |
| Auto-translate delay | 自动翻译触发延迟（毫秒） | `500` |

配置完成后可点击设置中的 **Test** 按钮验证 API 连接。

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
npm install
npm run build
```

开发模式（自动重新构建）：

```bash
npm run dev
```

## 许可证

[MIT](LICENSE)
