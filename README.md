<div align="center">

# Tabryn

**The Browser Runtime for AI Agents**

*Your browser. Your session. Any agent.*

[![CI](https://github.com/idugeni/tabryn/actions/workflows/ci.yml/badge.svg)](https://github.com/idugeni/tabryn/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/tabryn.svg)](https://www.npmjs.com/package/tabryn)
[![license](https://img.shields.io/npm/l/tabryn.svg)](https://github.com/idugeni/tabryn/blob/main/LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/typescript-6.0-blue.svg)](https://www.typescriptlang.org)
[![vitest](https://img.shields.io/badge/tested%20with-vitest-6e9f17.svg)](https://vitest.dev)

<br/>

[Installation](#installation) • [Features](#features) • [Architecture](#architecture) • [Tools](#available-tools) • [CLI](#cli-commands) • [Contributing](#contributing)

</div>

---

Tabryn connects AI coding agents to the Chrome browser you're already using — existing tabs, existing sessions, real application state — through a universal MCP browser runtime.

## Why Tabryn?

Browser automation traditionally means running a separate browser or profile. Coding agents need controlled access to the real development browser — the one with your logged-in sessions, your localhost tabs, your actual application state. Tabryn bridges this gap.

<br/>

## Features

| Feature | Description |
|:--------|:------------|
| **Real Browser State** | Access your actual Chrome tabs, sessions, and cookies |
| **MCP Native** | First-class Model Context Protocol support |
| **Zero Config** | Works out of the box with your existing Chrome |
| **Secure by Design** | Local-only communication, no credential exposure |
| **Multi-Agent** | Works with Claude Code, Codex, Kiro, OpenCode, Gemini CLI, and more |

<br/>

## Installation

```bash
# Clone and build
git clone https://github.com/idugeni/tabryn.git
cd tabryn
npm install
npm run build

# Set up native messaging host
node dist/cli/index.js install
```

### Load Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` directory

That's it! Extension will auto-configure on first connection.

### Add to MCP Client

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add tabryn -- node /path/to/tabryn/dist/mcp/index.js
```

</details>

<details>
<summary><strong>VS Code / Cursor</strong></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "tabryn": {
      "command": "node",
      "args": ["/path/to/tabryn/dist/mcp/index.js"]
    }
  }
}
```

</details>

<details>
<summary><strong>Other MCP Clients</strong></summary>

Add to your MCP config:

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

</details>

### Verify

```bash
node dist/cli/index.js doctor
```

<br/>

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Agent   │────▶│  MCP Server │────▶│    Bridge   │────▶│   Chrome    │
│             │◀────│             │◀────│             │◀────│  Extension  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     stdio               TCP            Native Messaging      DevTools API
```

**Supported Agents:**

```
Claude Code ─┐
Codex CLI ───┤
Kiro ────────┤
OpenCode ────┤
OpenClaw ────┼──→ Tabryn ──→ Your Chrome
Hermes ──────┤
Gemini CLI ──┤
Custom Agent ┘
```

<br/>

## Available Tools

| Tool | Description |
|:-----|:------------|
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

<br/>

## Example: Development Workflow

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Agent: Edit code → Run dev server → list_tabs → find localhost tab     │
│  Agent: screenshot → inspect UI → read_console → find errors            │
│  Agent: click → interact → reload → verify fix                          │
└──────────────────────────────────────────────────────────────────────────┘
```

<br/>

## CLI Commands

| Command | Description |
|:--------|:------------|
| `tabryn install` | Set up native messaging host and extension |
| `tabryn mcp` | Start the MCP server |
| `tabryn doctor` | Diagnose setup and connection issues |

<br/>

## Configuration

### Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `TABRYN_PORT` | `18766` | TCP port for MCP server ↔ Bridge communication |

<br/>

## Security

Tabryn is designed with security as a first-class requirement:

- **No credential exposure** — Cookies, passwords, and session tokens are never sent to agents
- **Permission boundaries** — Users control which tabs are accessible
- **Input validation** — All messages are validated before processing
- **Local-only communication** — All traffic stays on localhost

See [SECURITY.md](SECURITY.md) for the full security model.

<br/>

## Architecture Decision Records

- [ADR-0001: Communication Protocol](docs/adr/ADR-0001-communication-protocol.md) — Why Native Messaging + TCP

<br/>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

<br/>

## License

[MIT](LICENSE) © [idugeni](https://github.com/idugeni)

<br/>

---

<div align="center">

**Built with ❤️ for the AI agent community**

[![GitHub Stars](https://img.shields.io/github/stars/idugeni/tabryn?style=social)](https://github.com/idugeni/tabryn)
[![GitHub Forks](https://img.shields.io/github/forks/idugeni/tabryn?style=social)](https://github.com/idugeni/tabryn)

</div>
