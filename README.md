# Tabryn

**The Browser Runtime for AI Agents.**

*Your browser. Your session. Any agent.*

---

Tabryn connects AI coding agents to the Chrome browser you're already using — existing tabs, existing sessions, real application state — through a universal MCP browser runtime.

## The Problem

Browser automation traditionally means running a separate browser or profile. Coding agents need controlled access to the real development browser — the one with your logged-in sessions, your localhost tabs, your actual application state. Tabryn bridges this gap.

## Architecture

```
Claude Code ─┐
Codex CLI ───┤
Kiro ────────┤
OpenCode ────┤
OpenClaw ────┼──→ MCP → Tabryn → Chrome → Existing Tabs
Hermes ──────┤
Gemini CLI ──┤
Custom Agent ┘
```

Tabryn is a three-component system:

1. **MCP Server** — Exposes browser tools via the Model Context Protocol (stdio)
2. **Bridge** — Native Messaging Host that connects the MCP server to Chrome
3. **Chrome Extension** — Controls Chrome using DevTools Protocol

```
AI Agent ←stdio→ MCP Server ←TCP→ Bridge ←Native Messaging→ Extension ←→ Chrome
```

## Quick Start

### 1. Install

```bash
git clone https://github.com/tabryn/tabryn.git
cd tabryn
npm install
npm run build
node dist/cli/index.js install
```

### 2. Load Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` directory
5. Copy the **Extension ID**

### 3. Configure

Edit the native host manifest with your Extension ID:

```bash
# The manifest location is shown during install
# Replace PLACEHOLDER_EXTENSION_ID with your actual ID
```

### 4. Restart Chrome

Close all Chrome windows and reopen.

### 5. Add to MCP Client

**Claude Code:**
```bash
claude mcp add tabryn -- node /path/to/tabryn/dist/mcp/index.js
```

**Other MCP clients**, add to your MCP config:
```json
{
  "mcpServers": {
    "tabryn": {
      "command": "node",
      "args": ["/path/to/tabryn/dist/mcp/index.js"]
    }
  }
}
```

### 6. Verify

```bash
node dist/cli/index.js doctor
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_tabs` | List all open Chrome tabs |
| `select_tab` | Activate a specific tab |
| `create_tab` | Open a new tab |
| `close_tab` | Close a tab |
| `navigate` | Navigate to URL or go back/forward |
| `read_page` | Read page accessibility tree |
| `screenshot` | Capture tab screenshot |
| `click` | Click at coordinates |
| `type` | Type text into focused element |
| `scroll` | Scroll the page |
| `form_input` | Set form element values |
| `execute_js` | Execute JavaScript in page context |
| `read_console` | Read console messages |
| `read_network` | Read network requests |
| `reload` | Reload the page |
| `wait` | Wait for page condition |

## Example: Development Workflow

```
Agent: Edit code → Run dev server → list_tabs → find localhost tab
Agent: screenshot → inspect UI → read_console → find errors
Agent: click → interact → reload → verify fix
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `tabryn install` | Set up native messaging host and extension |
| `tabryn mcp` | Start the MCP server |
| `tabryn doctor` | Diagnose setup and connection issues |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TABRYN_PORT` | `18766` | TCP port for MCP server ↔ Bridge communication |

### MCP Client Configuration

See [docs/mcp-configuration.md](docs/mcp-configuration.md) for detailed setup instructions for various MCP clients.

## Security

Tabryn is designed with security as a first-class requirement:

- **No credential exposure** — Cookies, passwords, and session tokens are never sent to agents
- **Permission boundaries** — Users control which tabs are accessible
- **Input validation** — All messages are validated before processing
- **Local-only communication** — All traffic stays on localhost

See [SECURITY.md](SECURITY.md) for the full security model.

## Architecture Decision Records

- [ADR-0001: Communication Protocol](docs/adr/ADR-0001-communication-protocol.md) — Why Native Messaging + TCP

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
