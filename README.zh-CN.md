# duoduo-in-obsidian

让 Obsidian 直接变成 duoduo agent 的聊天界面。  
对话内容以 **普通 Markdown** 写入当前笔记，支持流式输出和「一笔记一会话」的隔离。

---

## 功能特点

- **笔记内对话**
  - 每个 Markdown 视图底部都有一个常驻输入栏
  - 消息不是写在侧边栏，而是直接追加到当前 `.md` 文件末尾
  - 对话就是笔记，可以像普通内容一样编辑、搜索、整理、分享

- **轻量的消息格式**
  - **用户消息**是 blockquote：

    ```markdown
    > **You** · 10:05
    >
    > 帮我写一个防抖函数
    ```

  - **Agent 消息**是普通段落：

    ```markdown
    **Agent** · 10:05

    这是一个 TypeScript 实现：
    ```

  - **工具调用 / 思考过程** 会以斜体行追加，例如：

    ```markdown
    _🔧 Using tool: web_search("obsidian plugin api")_
    ```

  没有 Callout、没有自定义语法，预览和源码都干净。

- **真正的流式体验**
  - 使用 `@openduo/protocol`，通过 `channel.pull` 持续拉取 streaming 记录
  - `EditorAdapter` 只覆盖 Agent 消息 body，不重写整篇笔记
  - 使用 `requestAnimationFrame` 做节流，避免频繁渲染卡顿

- **按笔记隔离的 session**
  - 每个笔记都有自己的 `session_key`：
    - `session_key = obsidian:md5{notePath}`
  - 每个笔记也有自己的 channel / consumer：
    - `channel_id = md5{notePath}`
    - `consumer_id = md5{notePath}_consumer`
  - **无需在设置里配置 Session Key**，全部自动推导自笔记路径。

- **输入法友好的输入栏**
  - `Enter` 发送，`Shift+Enter` 换行
  - 监听 `compositionstart` / `compositionend`，保证中文输入法选词时按回车不会误发
  - 发送按钮 44×44，支持键盘可访问性（`focus-visible`）
  - 下方状态条有一个小圆点表示连接状态：
    - 灰色闪烁：正在检查连接
    - 绿色：已连接
    - 橙色跳动：Agent 正在处理
    - 红色：连接失败 / 异常

---

## 架构概览

- `ChatController`
  - 中枢协调层
  - 负责把用户输入送到 `AgentClient`，再把返回流式写入编辑器
  - 根据 `view.file.path` 生成当前笔记的 `session_key` / `channel_id`

- `EditorInputBar`
  - 纯 UI 组件，只负责渲染输入框、发送按钮和状态条
  - 对外暴露 `onSend(text)` 回调，以及 `setStatus` / `setConnectionStatus` 等方法

- `EditorAdapter`
  - 封装对 `MarkdownView.editor` 的所有写入
  - 记录 Agent body 开始的行号 `streamingBodyLine`
  - 提供：
    - `insertHeader()`：插入 `**Agent** · HH:mm` 以及空行
    - `updateBody(text)`：节流后的流式更新
    - `finalizeBody(text)`：流式结束时写入最终内容
    - `appendUserBlock(block)`：在文件末尾追加用户消息
    - `appendLine(line)`：追加工具调用 / 思考等辅助信息

- `AgentClient`
  - 基于 Obsidian `requestUrl` 的 JSON-RPC 客户端
  - 实现：
    - `channel.ingress`：发送用户消息
    - `channel.pull`：长轮询拉取 streaming / final / tool 记录
    - `channel.ack`：提交游标
  - 对上层暴露统一回调：
    - `onStreamStart` / `onMessage` / `onStreamEnd`
    - `onToolUse` / `onError`

- `markdown/ChatParser.ts`
  - 负责把内部结构转成 Markdown 文本
  - 提供 `formatMessageBlock`、`formatStreamStart`、`formatToolUse` 等方法

---

## 消息格式细节

### 用户消息（blockquote）

```markdown
> **You** · 10:05
>
> 第一行
> 第二行
```

- `ChatController` 创建 `ChatMessage`，交给 `formatMessageBlock` 生成文本
- `EditorAdapter.appendUserBlock()` 把整个块追加到文件末尾

### Agent 消息（普通段落）

流式过程中：

```markdown
**Agent** · 10:05

部分内容▋
```

结束后：

```markdown
**Agent** · 10:05

完整回复内容。
```

`▋` 只在流式过程中显示，`onStreamEnd` 触发后会被移除。

### 工具事件

来自 `SessionExecutionEvent` 的思考 / 工具调用 / 结果，会被格式化成简短的斜体行，例如：

```markdown
_💭 Thinking: analyze current note structure..._
_🔧 Using tool: search_notes("debounce")_
_✅ Tool result: found 3 related notes._
```

---

## 前置条件

- 本地运行中的 **duoduo daemon**（默认 `http://127.0.0.1:20233`）
- daemon 需要实现：
  - `channel.ingress`
  - `channel.pull`
  - `channel.ack`
  - `/healthz`（HTTP 200 表示健康）
- 使用 npm 包 `@openduo/protocol` 提供的类型定义

---

## 插件设置

在 Obsidian 插件设置中可以配置：

- **Daemon URL**
  - 默认：`http://127.0.0.1:20233`
- **Source Kind**
  - 标识来源的字符串，默认 `"obsidian"`
- **默认笔记文件夹**
  - `Create new chat note` 命令新建聊天笔记的目录
- **高级设置**
  - **Pull 间隔 (ms)**：两次 `channel.pull` 之间的时间间隔（默认 50）
  - **Pull 等待 (ms)**：daemon 端长轮询等待时间（默认 0）

没有 Session Key 配置项，所有 `session_key` / `channel_id` / `consumer_id`
都由插件根据笔记路径自动计算。

---

## 通信流程

```text
用户输入 EditorInputBar
           ↓
ChatController.handleSend(text)
  - 通过 EditorAdapter 追加用户消息块
  - 调用 AgentClient.sendMessage(text)
           ↓
AgentClient.channel.ingress
           ↓
duoduo daemon
           ↓
AgentClient.channel.pull（长轮询）
           ↓
onStreamStart  → EditorAdapter.insertHeader()
onMessage      → EditorAdapter.updateBody(accumulatedText)
onStreamEnd    → EditorAdapter.finalizeBody(finalText)
onToolUse      → EditorAdapter.appendLine(formatToolUse(event))
```

---

## 本地开发

```bash
npm install
npm run dev     # 监听模式，文件变化时自动重新构建
npm run build   # 生产构建，输出到 dist/
```

构建完成后，`dist/` 目录包含插件所需的全部文件：

```text
dist/
├── main.js        # 打包后的插件代码
├── manifest.json  # 插件元数据
└── styles.css     # 样式
```

将 `dist/` 目录下的三个文件复制到 Obsidian vault 的插件目录即可：

```text
{your-vault}/.obsidian/plugins/duoduo-in-obsidian/
├── main.js
├── manifest.json
└── styles.css
```

