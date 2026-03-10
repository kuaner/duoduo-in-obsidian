# duoduo-in-obsidian

An Obsidian plugin that turns any markdown note into a first-class chat surface for a duoduo agent (Claude behind the scenes).  
Conversations are stored directly in the current note as readable Markdown, with proper streaming and per-note isolation.

> For a Chinese version of this document, see [简体中文](README.zh-CN.md).

---

## Features

![duoduo in Obsidian screenshot](assets/screenshot.png)

- **Inline chat in notes**
  - Persistent input bar at the bottom of every `MarkdownView`
  - Messages are appended to the open `.md` file instead of a side panel
  - You can edit, search, refactor, and share chats like any other note

- **Lightweight, readable message format**
  - **User messages** are blockquotes:

    ```markdown
    > **You** · 10:05
    >
    > Help me write a debounce function.
    ```

  - **Assistant messages** are plain paragraphs:

    ```markdown
    **Agent** · 10:05

    Here's a TypeScript implementation:
    ```

  - **Tool usage / thoughts** are appended as italic paragraphs, e.g.

    ```markdown
    _🔧 Using tool: web_search("obsidian plugin api")_
    ```

  No callouts, no custom syntax – just normal Markdown that still looks good in preview.

- **Streaming that actually feels real-time**
  - Uses `@openduo/protocol` and `channel.pull` streaming records
  - `EditorAdapter` only appends/overwrites the assistant body, never rewrites the whole file
  - Rendering is throttled with `requestAnimationFrame` to avoid UI jank

- **Per-note sessions by default**
  - Every note gets its **own** `session_key`:
    - `session_key = obsidian:md5{notePath}`
  - Every note also gets its own channel and consumer:
    - `channel_id = md5{notePath}`
    - `consumer_id = md5{notePath}_consumer`
  - You do **not** configure any Session Key manually; the plugin handles it.

- **Modern, IME-friendly input bar**
  - Textarea with `Enter` to send, `Shift+Enter` for newline
  - Composition events (`compositionstart` / `compositionend`) ensure
    pressing Enter in Chinese IME does **not** accidentally send
  - 44×44 send button for touch friendliness, proper `:focus-visible`
  - Status row with a connection dot:
    - grey blinking: checking
    - green: connected
    - orange pulsing: processing
    - red: disconnected / error

---

## Architecture

High-level pieces:

- `ChatController`
  - Orchestrates everything
  - Wires user input → `AgentClient` → editor streaming
  - Derives per-note `session_key` / `channel_id` from `view.file.path`

- `EditorInputBar`
  - Pure UI component at the bottom of the `MarkdownView`
  - Handles textarea, send button, status dot and text
  - Exposes callbacks like `onSend(text)` and methods like `setStatus`, `setConnectionStatus`

- `EditorAdapter`
  - Encapsulates all `MarkdownView.editor` writes
  - Knows where the assistant body starts (`streamingBodyLine`)
  - Provides:
    - `insertHeader()` – inserts `**Agent** · HH:mm` + blank line
    - `updateBody(text)` – throttled streaming updates
    - `finalizeBody(text)` – final content once streaming ends
    - `appendUserBlock(block)` – appends formatted user message
    - `appendLine(line)` – used for tool events

- `AgentClient`
  - Thin JSON-RPC client over Obsidian’s `requestUrl`
  - Implements:
    - `channel.ingress` to send user text
    - `channel.pull` with `return_mask = ["final","stream","tool"]`
    - `channel.ack` for cursor advancement
  - Normalizes outbound events into callbacks:
    - `onStreamStart`, `onMessage`, `onStreamEnd`, `onToolUse`, `onError`

- `markdown/ChatParser.ts`
  - Formats and parses the blockquote/plaintext chat format
  - `formatMessageBlock`, `formatStreamStart`, `formatToolUse`

---

## Message format details

### User messages (blockquote)

```markdown
> **You** · 10:05
>
> First line of the message
> Second line of the message
```

- `ChatController` builds a `ChatMessage` and uses `formatMessageBlock` to
  generate this block.
- `EditorAdapter.appendUserBlock()` appends it at the end of the file,
  inserting blank lines if needed.

### Assistant messages (plain paragraphs)

During streaming:

```markdown
**Agent** · 10:05

Partial text▋
```

After completion:

```markdown
**Agent** · 10:05

Full assistant response here.
```

The trailing block cursor `▋` is only present while streaming, then removed
when `onStreamEnd` fires.

### Tool events

Tool-related events (thoughts, tool calls, tool results) from
`SessionExecutionEvent` are formatted into short, italic lines and appended at
the end of the file. Example:

```markdown
_💭 Thinking: analyze current note structure..._
_🔧 Using tool: search_notes("debounce")_
_✅ Tool result: found 3 related notes._
```

---

## Requirements

- A **duoduo daemon** running locally (default `http://127.0.0.1:20233`)
- The daemon must implement:
  - `channel.ingress`
  - `channel.pull`
  - `channel.ack`
  - `/healthz` for a simple HTTP 200 health check
- The `@openduo/protocol` npm package is used for all protocol types.

---

## Settings

In Obsidian’s plugin settings you can configure:

- **Daemon URL**
  - Default: `http://127.0.0.1:20233`
- **Source Kind**
  - Arbitrary string identifying this client, default `"obsidian"`
- **Default Note Folder**
  - Where `Create new chat note` will create notes
- **Advanced**
  - **Pull interval (ms)** – delay between `channel.pull` polls (default 50)
  - **Pull wait (ms)** – long-poll wait on the daemon side (default 0)

There is **no Session Key field** – all session and channel identifiers are
derived automatically from the note path.

---

## Communication flow

```text
User types in EditorInputBar
           ↓
ChatController.handleSend(text)
  - append user block to editor via EditorAdapter
  - call AgentClient.sendMessage(text)
           ↓
AgentClient.channel.ingress
           ↓
duoduo daemon
           ↓
AgentClient.channel.pull (long polling)
           ↓
onStreamStart  → EditorAdapter.insertHeader()
onMessage      → EditorAdapter.updateBody(accumulatedText)
onStreamEnd    → EditorAdapter.finalizeBody(finalText)
onToolUse      → EditorAdapter.appendLine(formatToolUse(event))
```

---

## Development

```bash
npm install
npm run dev     # watch mode, rebuild on changes
npm run build   # production build into dist/
```

After `npm run build`, you’ll get:

```text
dist/
├── main.js        # bundled plugin code
├── manifest.json  # plugin manifest
└── styles.css     # plugin styles
```

Copy these three files into your vault’s plugin folder:

```text
{your-vault}/.obsidian/plugins/duoduo-in-obsidian/
├── main.js
├── manifest.json
└── styles.css
```
