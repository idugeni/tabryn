# Tabryn Architecture

## Overview

Tabryn is a universal browser runtime for AI agents. It enables AI coding agents to control, inspect, test, and debug through existing Chrome tabs and sessions via the Model Context Protocol (MCP).

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Agent                                 │
│  (Claude Code, Codex CLI, Kiro, OpenCode, etc.)                │
└─────────────────────┬───────────────────────────────────────────┘
                      │ stdio (JSON-RPC)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Server                                   │
│  • Registers tools via MCP SDK                                   │
│  • Validates and routes tool requests                            │
│  • Manages connection to Bridge                                  │
│  • Handles protocol version negotiation                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ TCP (localhost:18766)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Bridge                                      │
│  (Native Messaging Host)                                         │
│  • Translates between TCP and Native Messaging protocols         │
│  • Manages reconnection to MCP server                            │
│  • Launched by Chrome on extension startup                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Native Messaging (stdin/stdout)
                      │ 4-byte LE length prefix + JSON
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Chrome Extension                                  │
│  • Manifest V3 service worker                                    │
│  • Uses chrome.debugger API for CDP                              │
│  • Captures console/network events                               │
│  • Handles page interaction (click, type, scroll)                │
└─────────────────────┬───────────────────────────────────────────┘
                      │ chrome.debugger (CDP)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Google Chrome                                   │
│  • Existing tabs and sessions                                    │
│  • Real application state                                        │
│  • User's authenticated sessions                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Communication Protocols

### 1. AI Agent ↔ MCP Server (stdio)

The AI agent communicates with the MCP server via standard input/output using the Model Context Protocol. This is a JSON-RPC based protocol managed by the `@modelcontextprotocol/sdk`.

### 2. MCP Server ↔ Bridge (TCP)

The MCP server connects to the Bridge via a TCP socket on localhost. This allows:
- Multiple MCP server instances to share a single Bridge
- Clean separation of concerns
- Easy reconnection handling

Message format: Newline-delimited JSON.

### 3. Bridge ↔ Extension (Native Messaging)

Chrome's Native Messaging protocol is used for communication between the Bridge and the Chrome Extension:
- **Format**: 4-byte little-endian length prefix followed by JSON
- **Limits**: 1 MB from host to extension, 64 MB from extension to host
- **Lifecycle**: Chrome launches the Bridge process when the extension calls `chrome.runtime.connectNative()`

### 4. Extension ↔ Chrome (CDP)

The Chrome Extension uses the `chrome.debugger` API to interact with Chrome via the Chrome DevTools Protocol (CDP):
- `Page.captureScreenshot` for screenshots
- `Input.dispatchMouseEvent` for clicks
- `Input.dispatchKeyEvent` for typing
- `Runtime.evaluate` for JavaScript execution
- `Console.enable` for console capture
- `Network.enable` for network monitoring

## Protocol Types

All messages between components are typed and validated. See `src/shared/types.ts` for the full type definitions.

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `tool_request` | MCP → Bridge → Extension | Execute a tool |
| `tool_response` | Extension → Bridge → MCP | Return tool result |
| `tool_error` | Extension → Bridge → MCP | Report tool error |
| `heartbeat` | Both directions | Keep connection alive |
| `connect` | MCP → Bridge | Capability negotiation |
| `disconnect` | Either direction | Connection closed |

## Tool Categories

### Tab Management
- `list_tabs` — Discover available tabs
- `select_tab` — Focus a specific tab
- `create_tab` — Open new tabs
- `close_tab` — Clean up tabs

### Navigation
- `navigate` — Load URLs, go back/forward
- `reload` — Refresh pages
- `wait` — Wait for page conditions

### Inspection
- `read_page` — Get accessibility tree
- `screenshot` — Visual capture
- `read_console` — Debug logs
- `read_network` — API calls

### Interaction
- `click` — Mouse clicks
- `type` — Keyboard input
- `scroll` — Page scrolling
- `form_input` — Form filling
- `execute_js` — Custom JavaScript

## Error Handling

All errors are typed with specific error codes:

```typescript
type ErrorCode =
  | "CONNECTION_FAILED"
  | "CONNECTION_TIMEOUT"
  | "TOOL_NOT_FOUND"
  | "TOOL_TIMEOUT"
  | "BROWSER_NOT_CONNECTED"
  | "TAB_NOT_FOUND"
  | "NAVIGATION_FAILED"
  | ...
```

Errors propagate through the chain:
1. Extension catches error → sends `tool_error` message
2. Bridge forwards `tool_error` to MCP server
3. MCP server converts to MCP error response
4. AI agent receives actionable error message

## Security Model

See [SECURITY.md](SECURITY.md) for the full security model.

Key principles:
1. **No credential exposure** — Browser secrets never leave Chrome
2. **Local-only** — All communication on localhost
3. **Input validation** — All messages validated before processing
4. **Permission boundaries** — Users control tab access

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Windows | Primary | Full support |
| macOS | Supported | Full support |
| Linux | Supported | Full support |

Platform-specific code is isolated in:
- `src/cli/index.ts` — Installation paths
- `extension/` — Chrome APIs (platform-agnostic)

## Performance Considerations

- **TCP connection pooling** — Reuse connections to Bridge
- **Event buffering** — Console/network events capped at 200/100
- **Lazy CDP attachment** — Debugger attached only when needed
- **Heartbeat** — Keep connections alive without overhead
